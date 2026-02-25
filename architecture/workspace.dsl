workspace "E-Commerce Platform" "Architecture documentation for the e-commerce microservices platform" {

    model {
        # External actors
        customer = person "Customer" "A customer who browses and purchases products" "Customer"
        admin = person "Admin" "An administrator who manages products and orders" "Admin"

        # External systems
        paymentGateway = softwareSystem "Payment Gateway" "Handles payment processing (Stripe)" "External System"
        emailProvider = softwareSystem "Email Provider" "Sends transactional emails (SendGrid)" "External System"

        # Our system
        ecommerce = softwareSystem "E-Commerce Platform" "Allows customers to browse products and place orders" {

            # Containers
            apiGateway = container "API Gateway" "Single entry point for all client requests. Handles routing, rate limiting, and authentication." "Node.js/Express" "Gateway"

            userService = container "User Service" "Manages user accounts, authentication, and profiles" "Node.js/Express" "Service" {
                userController = component "User Controller" "REST API endpoints for user operations" "Express Router"
                authService = component "Auth Service" "Handles JWT token generation and validation" "jsonwebtoken"
                userRepository = component "User Repository" "Data access layer for user data" "pg"
                cacheService = component "Cache Service" "Caches user sessions and frequently accessed data" "redis"
            }

            orderService = container "Order Service" "Handles order creation, processing, and history" "Node.js/Express" "Service" {
                orderController = component "Order Controller" "REST API endpoints for order operations" "Express Router"
                orderProcessor = component "Order Processor" "Business logic for order processing" "Custom"
                orderRepository = component "Order Repository" "Data access layer for order data" "pg"
                messagePublisher = component "Message Publisher" "Publishes order events to message queue" "amqplib"
            }

            notificationService = container "Notification Service" "Sends notifications for order events" "Node.js" "Service" {
                messageConsumer = component "Message Consumer" "Consumes order events from queue" "amqplib"
                emailSender = component "Email Sender" "Sends emails via SMTP" "nodemailer"
            }

            # Data stores
            postgresDb = container "PostgreSQL Database" "Stores user and order data" "PostgreSQL 15" "Database"
            redisCache = container "Redis Cache" "Caches sessions and hot data" "Redis 7" "Database"
            rabbitMq = container "RabbitMQ" "Message broker for async communication" "RabbitMQ 3" "Queue"

            # Container-level relationships (inside ecommerce scope)
            apiGateway -> userService "Routes user requests" "HTTP/JSON"
            apiGateway -> orderService "Routes order requests" "HTTP/JSON"

            userService -> postgresDb "Reads/writes user data" "TCP/SQL"
            userService -> redisCache "Caches sessions" "TCP/Redis Protocol"

            orderService -> postgresDb "Reads/writes order data" "TCP/SQL"
            orderService -> userService "Validates users" "HTTP/JSON"
            orderService -> rabbitMq "Publishes order events" "AMQP" "Async"

            notificationService -> rabbitMq "Consumes order events" "AMQP" "Async"
        }

        # System Context relationships
        customer -> ecommerce "Places orders, manages account"
        admin -> ecommerce "Manages products and orders"
        ecommerce -> paymentGateway "Processes payments"
        ecommerce -> emailProvider "Sends transactional emails"

        # Person to container relationships
        customer -> apiGateway "Makes API requests" "HTTPS/JSON"
        admin -> apiGateway "Makes API requests" "HTTPS/JSON"

        # External system relationships
        notificationService -> emailProvider "Sends emails" "SMTP"

        # Component-level relationships (User Service)
        apiGateway -> userController "Routes requests"
        userController -> authService "Authenticates requests"
        userController -> userRepository "CRUD operations"
        authService -> cacheService "Stores/validates sessions"
        userRepository -> postgresDb "SQL queries"
        cacheService -> redisCache "Cache operations"

        # Component-level relationships (Order Service)
        apiGateway -> orderController "Routes requests"
        orderController -> orderProcessor "Processes orders"
        orderProcessor -> orderRepository "Persists orders"
        orderProcessor -> messagePublisher "Publishes events"
        orderRepository -> postgresDb "SQL queries"
        messagePublisher -> rabbitMq "Publishes messages" "" "Async"

        # Component-level relationships (Notification Service)
        messageConsumer -> rabbitMq "Subscribes to events" "" "Async"
        messageConsumer -> emailSender "Triggers emails"
        emailSender -> emailProvider "Sends via SMTP"
    }

    views {
        systemContext ecommerce "SystemContext" {
            include *
            autoLayout
            description "System Context diagram showing the e-commerce platform and its external dependencies"
        }

        container ecommerce "Containers" {
            include *
            autoLayout
            description "Container diagram showing the microservices architecture"
        }

        component userService "UserServiceComponents" {
            include *
            autoLayout
            description "Component diagram for the User Service"
        }

        component orderService "OrderServiceComponents" {
            include *
            autoLayout
            description "Component diagram for the Order Service"
        }

        component notificationService "NotificationServiceComponents" {
            include *
            autoLayout
            description "Component diagram for the Notification Service"
        }

        styles {
            element "Person" {
                shape Person
                background #08427B
                color #ffffff
            }
            element "Customer" {
                background #08427B
            }
            element "Admin" {
                background #999999
            }
            element "Software System" {
                background #1168BD
                color #ffffff
            }
            element "External System" {
                background #999999
                color #ffffff
            }
            element "Container" {
                background #438DD5
                color #ffffff
            }
            element "Service" {
                shape RoundedBox
            }
            element "Gateway" {
                shape Hexagon
            }
            element "Database" {
                shape Cylinder
            }
            element "Queue" {
                shape Pipe
            }
            element "Component" {
                background #85BBF0
                color #000000
            }
            relationship "Async" {
                dashed true
                color #ff6600
            }
        }
    }
}
