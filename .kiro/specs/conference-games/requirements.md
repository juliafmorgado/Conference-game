# Requirements Document

## Introduction

The Conference Games web app is a simple, fast, and offline-tolerant application designed for conference hosts to run interactive games on laptops, tablets or phones. The system supports two game modes: "Finish the Sentence" with 30-second timers and "Guess the Acronym" with 10-second timers. The application must perform reliably on spotty expo Wi-Fi and be deployable to AWS EKS via Helm.

## Glossary

- **Conference_Games_System**: The complete web application including frontend, backend, and deployment components
- **Game_Host**: A conference presenter or facilitator using the application to run games
- **Game_Session**: An active instance of either Finish the Sentence or Guess the Acronym game mode
- **Timer_Component**: The countdown timer display with visual and audio feedback
- **Content_Repository**: The backend storage system containing sentences and acronyms data
- **EKS_Cluster**: Amazon Elastic Kubernetes Service cluster where the application is deployed

## Requirements

### Requirement 1

**User Story:** As a Game_Host, I want to select between two game modes from a landing screen, so that I can choose the appropriate game for my conference session.

#### Acceptance Criteria

1. THE Conference_Games_System SHALL display a landing screen with two clearly labeled buttons for "Finish the Sentence" and "Guess the Acronym"
2. WHEN the Game_Host selects a game mode button, THE Conference_Games_System SHALL navigate to the corresponding game interface
3. THE Conference_Games_System SHALL optimize the interface layout for horizontal tablet, laptop screen and horizontal phone orientations
4. THE Conference_Games_System SHALL use large, high-contrast typography suitable for video recording

### Requirement 2

**User Story:** As a Game_Host, I want to run "Finish the Sentence" games with random prompts and a 30-second timer, so that I can engage conference attendees in interactive discussions.

#### Acceptance Criteria

1. WHEN the Game_Host enters Finish the Sentence mode, THE Conference_Games_System SHALL display one random sentence prompt in large, centered text
2. THE Conference_Games_System SHALL provide a visible 30-second countdown timer with numeric display
3. WHEN the timer reaches zero, THE Conference_Games_System SHALL play an audio alert and display a "Time!" notification in red
4. THE Conference_Games_System SHALL provide Shuffle, Previous, and Restart Timer control buttons
5. WHERE category filtering is enabled, THE Conference_Games_System SHALL randomize prompts

### Requirement 3

**User Story:** As a Game_Host, I want to run "Guess the Acronym" games with random acronyms and reveal functionality, so that I can test attendees' technical knowledge.

#### Acceptance Criteria

1. WHEN the Game_Host enters Guess the Acronym mode, THE Conference_Games_System SHALL display one random acronym in large, centered text
2. THE Conference_Games_System SHALL provide a 10-second countdown timer with visual progress indication
3. THE Conference_Games_System SHALL provide a "Reveal Meaning" button that toggles the acronym definition display
4. THE Conference_Games_System SHALL provide Shuffle and Restart Timer control buttons
5. WHEN the timer expires, THE Conference_Games_System SHALL play an audio alert and time displayed on screen in red

### Requirement 4

**User Story:** As a Game_Host, I want keyboard shortcuts for common actions, so that I can efficiently control the games during presentations.

#### Acceptance Criteria

1. WHEN the Game_Host presses the spacebar, THE Conference_Games_System SHALL restart the current timer
2. WHEN the Game_Host presses the right arrow key, THE Conference_Games_System SHALL advance to the next random item
3. WHEN the Game_Host presses the left arrow key, THE Conference_Games_System SHALL return to the previous item




### Requirement 8

**User Story:** As a system administrator, I want to deploy the application to EKS using Helm charts, so that I can manage the application infrastructure efficiently.

#### Acceptance Criteria

1. THE Conference_Games_System SHALL include Helm charts for Kubernetes deployment
2. THE Conference_Games_System SHALL support deployment to AWS EKS clusters
3. THE Conference_Games_System SHALL use ConfigMaps for game content configuration
4. THE Conference_Games_System SHALL include health check endpoints for Kubernetes liveness and readiness probes
5. THE Conference_Games_System SHALL support horizontal scaling of backend services

### Requirement 9

**User Story:** As a system administrator, I want to configure game content through JSON files, so that I can update prompts and acronyms without code changes.

#### Acceptance Criteria

1. THE Conference_Games_System SHALL load sentence prompts from a sentences.json ConfigMap
2. THE Conference_Games_System SHALL load acronym definitions from an acronyms.json ConfigMap
4. THE Conference_Games_System SHALL provide REST API endpoints at /api/sentences and /api/acronyms
5. WHEN content files are updated, THE Conference_Games_System SHALL reflect changes without requiring application restart
