/**
 * Database service for PostgreSQL integration
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../index';

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface GameSession {
  id: string;
  gameType: 'finish-sentence' | 'guess-acronym';
  startedAt: Date;
  endedAt?: Date;
  itemsShown: number;
  category?: string;
}

export interface AppConfig {
  key: string;
  value: string;
  updatedAt: Date;
}

export class DatabaseService {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private initialized = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Initialize database connection pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const poolConfig: PoolConfig = {
        connectionString: this.config.connectionString,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
        max: this.config.maxConnections || 20, // Maximum number of connections
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000, // Close idle connections after 30s
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 2000, // Timeout for new connections
        // Performance optimizations
        statement_timeout: 30000, // 30 second statement timeout
        query_timeout: 30000, // 30 second query timeout
        application_name: 'conference-games-api'
      };

      this.pool = new Pool(poolConfig);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Create tables if they don't exist
      await this.createTables();

      this.initialized = true;
      logger.info('Database service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    message: string;
    responseTime: number;
  }> {
    const startTime = Date.now();

    try {
      if (!this.initialized || !this.pool) {
        return {
          healthy: false,
          message: 'Database not initialized',
          responseTime: Date.now() - startTime
        };
      }

      // Test connection with a simple query
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      return {
        healthy: true,
        message: 'Database connection successful',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();

    try {
      // Create game_sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS game_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          game_type VARCHAR(50) NOT NULL CHECK (game_type IN ('finish-sentence', 'guess-acronym')),
          started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ended_at TIMESTAMP WITH TIME ZONE,
          items_shown INTEGER DEFAULT 0 CHECK (items_shown >= 0),
          category VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create app_config table
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_config (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_game_sessions_game_type 
        ON game_sessions(game_type)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at 
        ON game_sessions(started_at)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_game_sessions_category 
        ON game_sessions(category) WHERE category IS NOT NULL
      `);

      // Create trigger to update updated_at timestamp
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS update_game_sessions_updated_at ON game_sessions
      `);

      await client.query(`
        CREATE TRIGGER update_game_sessions_updated_at
        BEFORE UPDATE ON game_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);

      logger.info('Database tables created successfully');
    } finally {
      client.release();
    }
  }

  /**
   * Create a new game session
   */
  async createGameSession(gameType: 'finish-sentence' | 'guess-acronym', category?: string): Promise<string> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        'INSERT INTO game_sessions (game_type, category) VALUES ($1, $2) RETURNING id',
        [gameType, category]
      );

      const sessionId = result.rows[0].id;
      logger.debug(`Created game session: ${sessionId}`);
      return sessionId;
    } finally {
      client.release();
    }
  }

  /**
   * Update game session
   */
  async updateGameSession(sessionId: string, updates: {
    endedAt?: Date;
    itemsShown?: number;
  }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();

    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.endedAt !== undefined) {
        setParts.push(`ended_at = $${paramIndex++}`);
        values.push(updates.endedAt);
      }

      if (updates.itemsShown !== undefined) {
        setParts.push(`items_shown = $${paramIndex++}`);
        values.push(updates.itemsShown);
      }

      if (setParts.length === 0) {
        return; // Nothing to update
      }

      values.push(sessionId);
      const query = `UPDATE game_sessions SET ${setParts.join(', ')} WHERE id = $${paramIndex}`;

      await client.query(query, values);
      logger.debug(`Updated game session: ${sessionId}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get game session by ID
   */
  async getGameSession(sessionId: string): Promise<GameSession | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        'SELECT * FROM game_sessions WHERE id = $1',
        [sessionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        gameType: row.game_type,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        itemsShown: row.items_shown,
        category: row.category
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get game sessions with filtering and pagination
   */
  async getGameSessions(options: {
    gameType?: 'finish-sentence' | 'guess-acronym';
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    sessions: GameSession[];
    total: number;
  }> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();

    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (options.gameType) {
        conditions.push(`game_type = $${paramIndex++}`);
        values.push(options.gameType);
      }

      if (options.category) {
        conditions.push(`category = $${paramIndex++}`);
        values.push(options.category);
      }

      if (options.startDate) {
        conditions.push(`started_at >= $${paramIndex++}`);
        values.push(options.startDate);
      }

      if (options.endDate) {
        conditions.push(`started_at <= $${paramIndex++}`);
        values.push(options.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM game_sessions ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get sessions with pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const sessionsQuery = `
        SELECT * FROM game_sessions 
        ${whereClause} 
        ORDER BY started_at DESC 
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      const sessionsResult = await client.query(sessionsQuery, [...values, limit, offset]);

      const sessions: GameSession[] = sessionsResult.rows.map(row => ({
        id: row.id,
        gameType: row.game_type,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        itemsShown: row.items_shown,
        category: row.category
      }));

      return { sessions, total };
    } finally {
      client.release();
    }
  }

  /**
   * Set application configuration value
   */
  async setConfig(key: string, value: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();

    try {
      await client.query(
        `INSERT INTO app_config (key, value) 
         VALUES ($1, $2) 
         ON CONFLICT (key) 
         DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );

      logger.debug(`Set config: ${key} = ${value}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get application configuration value
   */
  async getConfig(key: string): Promise<string | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        'SELECT value FROM app_config WHERE key = $1',
        [key]
      );

      return result.rows.length > 0 ? result.rows[0].value : null;
    } finally {
      client.release();
    }
  }

  /**
   * Get all application configuration
   */
  async getAllConfig(): Promise<Record<string, string>> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();

    try {
      const result = await client.query('SELECT key, value FROM app_config');
      
      const config: Record<string, string> = {};
      for (const row of result.rows) {
        config[row.key] = row.value;
      }

      return config;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a raw query (for migrations, etc.)
   */
  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();

    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    if (!this.pool) {
      return { totalCount: 0, idleCount: 0, waitingCount: 0 };
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Close database connections
   */
  async cleanup(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.initialized = false;
    logger.info('Database service cleaned up');
  }
}

// Singleton instance
let databaseServiceInstance: DatabaseService | null = null;

/**
 * Create database service instance
 */
export function createDatabaseService(config: DatabaseConfig): DatabaseService {
  if (databaseServiceInstance) {
    throw new Error('Database service already created');
  }

  databaseServiceInstance = new DatabaseService(config);
  return databaseServiceInstance;
}

/**
 * Get database service instance
 */
export function getDatabaseService(): DatabaseService {
  if (!databaseServiceInstance) {
    throw new Error('Database service not created. Call createDatabaseService first.');
  }

  return databaseServiceInstance;
}

/**
 * Create default database service from environment
 */
export function createDefaultDatabaseService(envConfig?: any): DatabaseService | null {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    logger.info('No DATABASE_URL provided, skipping database initialization');
    return null;
  }

  const config: DatabaseConfig = {
    connectionString: databaseUrl,
    maxConnections: envConfig?.DB_MAX_CONNECTIONS || parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: envConfig?.DB_IDLE_TIMEOUT || parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: envConfig?.DB_CONNECTION_TIMEOUT || parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    ssl: process.env.NODE_ENV === 'production'
  };

  return createDatabaseService(config);
}