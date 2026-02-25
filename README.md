# Living C4 Architecture

Automated drift detection between Structurizr DSL architecture diagrams and actual code. Keep your architecture documentation in sync with reality.

**Companion code for the C4 series on [The Engineer's Lens](https://github.com/lnm8910/the-engineers-lens):**
- [Part 1: C4 Model Deep Dive](https://github.com/lnm8910/the-engineers-lens/blob/main/8.living-c4-architecture/docs/c4-model-deep-dive.md) - C4 fundamentals, the 4 levels, Structurizr DSL
- [Part 2: Living C4](https://github.com/lnm8910/the-engineers-lens/blob/main/8.living-c4-architecture/docs/living-c4-architecture.md) - Drift detection, CI/CD, auto-generated diagrams

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose

### Run the Sample Application

```bash
cd sample-app
docker-compose up -d
```

Services will be available at:
- API Gateway: http://localhost:8080
- User Service: http://localhost:3001
- Order Service: http://localhost:3002
- RabbitMQ Management: http://localhost:15672
- MailHog (email viewer): http://localhost:8025

### Validate Architecture

```bash
cd scripts
npm install

# Validate Structurizr DSL syntax
node validate-dsl.js

# Detect drift between docs and code
node detect-drift.js
```

### Generate Diagrams Locally

Install [Structurizr CLI](https://github.com/structurizr/cli):

```bash
# macOS
brew install structurizr-cli

# Or download manually
curl -L -o structurizr-cli.zip \
  https://github.com/structurizr/cli/releases/latest/download/structurizr-cli.zip
unzip structurizr-cli.zip
```

Generate PNG diagrams:

```bash
structurizr-cli export \
  -workspace architecture/workspace.dsl \
  -format png \
  -output docs/diagrams
```

### Use Structurizr Lite (Visual Editor)

```bash
docker run -it --rm -p 8080:8080 \
  -v $(pwd)/architecture:/usr/local/structurizr \
  structurizr/lite
```

Open http://localhost:8080 to view and edit diagrams interactively.

## Project Structure

```
living-c4-architecture/
├── architecture/
│   └── workspace.dsl       # Structurizr DSL - C4 model definition
├── sample-app/
│   ├── docker-compose.yml  # Actual infrastructure definition
│   ├── api-gateway/        # Gateway service (port 8080)
│   ├── user-service/       # User management (port 3001)
│   ├── order-service/      # Order processing (port 3002)
│   └── notification-service/ # Async notification sender
├── scripts/
│   ├── detect-drift.js     # Compares DSL vs docker-compose
│   ├── validate-dsl.js     # Validates DSL syntax
│   └── package.json
└── .github/workflows/
    └── architecture-check.yml  # CI pipeline
```

## How Drift Detection Works

The drift detector compares two sources of truth:

1. **Documented Architecture** (`architecture/workspace.dsl`)
   - Defines containers, relationships, and dependencies
   - Parsed directly by the drift detection script

2. **Actual Implementation** (`sample-app/docker-compose.yml`)
   - Defines real services and their configuration

### Checks Performed

- **Service Existence** - Every DSL container exists in docker-compose
- **Undocumented Services** - No services in docker-compose missing from DSL
- **Source Directories** - Inferred source paths exist on disk
- **Dependencies** - `depends_on` and env vars match DSL relationships

### Triggering Drift

Try adding a service to `docker-compose.yml` without updating `workspace.dsl`:

```yaml
# Add to sample-app/docker-compose.yml
inventory-service:
  build: ./inventory-service
  ports:
    - "3003:3003"
```

Run detection:

```bash
node scripts/detect-drift.js
# ERROR: Service "inventory-service" is in docker-compose but NOT in workspace.dsl
```

## CI/CD Integration

The GitHub Actions workflow:

**On Pull Requests:**
- Validates DSL syntax
- Runs drift detection
- Blocks merge if either fails

**On Push to Main:**
- Same validation
- Auto-generates PNG/SVG diagrams
- Commits them to the repo
- Creates GitHub issue if drift detected

## Architecture Views

### Level 1: System Context
Shows the e-commerce platform with external actors (Customer, Admin) and external systems (Payment Gateway, Email Provider).

### Level 2: Containers
Shows the microservices architecture: API Gateway, User Service, Order Service, Notification Service, PostgreSQL, Redis, RabbitMQ.

### Level 3: Components
Detailed component diagrams for each service showing controllers, services, repositories, and their relationships.

## Resources

- [C4 Model](https://c4model.com/) - The C4 model for visualizing software architecture
- [Structurizr DSL](https://docs.structurizr.com/dsl) - DSL language reference
- [Structurizr Tooling](https://docs.structurizr.com/) - CLI, diagram generation, and related tools

## License

MIT
