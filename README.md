# Transaction Service — Scalable Banking System

This microservice handles **deposits, transfers, and transaction history** for the Scalable Banking application.  
It is designed using a **microservices architecture** — independently deployable, containerized, and monitored via Prometheus + Grafana.


## Tech Stack

| Component | Technology |
|------------|-------------|
| Language | Node.js (Express.js) |
| Database | PostgreSQL |
| Message Broker | RabbitMQ |
| Containerization | Docker |
| Orchestration | Kubernetes (Minikube) |
| Monitoring | Prometheus + Grafana |
| Logging | Winston (structured JSON) |


## Key Features

 **Business Rules**
- No overdraft for basic accounts  
- Daily transfer limit (₹2,00,000)  
- Frozen/inactive accounts cannot transact  

 **Reliability**
- Idempotency-Key header for safe retries  
- Correlation-ID for distributed tracing  
- Circuit breaker + retry logic to Account Service  

 **Event Driven**
- Publishes `TRANSACTION_CREATED` and `TRANSFER_COMPLETED` to RabbitMQ queue (`transaction_events`)  

 **Observability**
- `/health`, `/metrics`, and `/db-check` endpoints  
- Prometheus + Grafana integration  
- RED metrics dashboard auto-provisioned  


##  Folder Structure
transaction-service/
├── src/
│ ├── server.js # Express app entry point
│ ├── db.js # PostgreSQL connection
│ ├── routes/transactionRoutes.js
│ ├── messageQueue.js # RabbitMQ connection
│ ├── accountClient.js # Account Service API client
│ ├── logger.js # Winston JSON logger
│ └── middleware/correlationId.js
│
├── init/
│ ├── init.sql # DB schema + seed
│ └── transactions.csv # Seed data
│
├── openapi.yaml # Swagger specification
├── Dockerfile # Build image
├── .env # Local environment configuration
│
└── k8s/
├── transaction-service/
│ ├── deployment.yaml
│ ├── service.yaml
│ ├── openapi-configmap.yaml
├── postgres/
│ ├── deployment.yaml
│ └── service.yaml
├── rabbitmq/
│ └── deployment.yaml
└── monitoring/
├── prometheus-configmap.yaml
├── prometheus-deployment.yaml
├── grafana-deployment.yaml
└── grafana-dashboard-configmap.yaml


## Run Locally with Docker Compose

```bash
docker compose up --build

#Access locally:

Transaction Service → http://localhost:8082/api-docs

RabbitMQ UI → http://localhost:15672

Prometheus → http://localhost:9090 (guest/guest)

Grafana → http://localhost:3000 (admin/admin)

#Start Minikube
minikube start
kubectl create namespace banking

#Build Local Image
cd transaction-service
minikube image build -t transaction-service:latest .

#Deploy Services
kubectl apply -f k8s/postgres/ -n banking
kubectl apply -f k8s/rabbitmq/ -n banking
kubectl apply -f k8s/transaction-service/ -n banking
kubectl apply -f k8s/monitoring/ -n banking

#Verify Deployment
kubectl get pods -n banking
kubectl get svc -n banking

#Open Services
minikube service transaction-service -n banking 
minikube service rabbitmq -n banking 
minikube service prometheus -n banking 
minikube service grafana -n banking 