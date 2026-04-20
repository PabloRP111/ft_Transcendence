DOCKER_BIN := $(shell which docker-compose 2>/dev/null || echo "docker compose")
COMPOSE=$(DOCKER_BIN) -f ./src/docker-compose.yml

all: up

build:
	@echo "🔨 Building images..."
	@$(COMPOSE) build

up:
	@echo "🚀 Starting containers..."
	@$(COMPOSE) up --build -d
	docker compose -f src/docker-compose.yml exec users sh -c "until nc -z postgres 5432; do sleep 1; done; node /app/src/seed.js"

up-no-build:
	@echo "🚀 Starting containers without rebuild..."
	@$(COMPOSE) up -d

down:
	@echo "🛑 Stopping containers..."
	@$(COMPOSE) down

reload: down up
	@echo "♻️ Reloading containers..."

fclean: down
	@echo "🧨 Removing project volumes..."
	@$(COMPOSE) down -v --rmi all --remove-orphans
	@docker volume ls -q | xargs -r docker volume rm -f
	@echo "🧹 Removing project images..."
	@$(DOCKER_BIN) -f ./src/docker-compose.yml build --no-cache
	@docker images -q | xargs -r docker rmi -f
	@echo "🗑 Clearing cookies..."
	@rm -f ./src/backend/gateway/src/cookies.txt
	@echo "✅ Cleanup complete"

logs:
	$(COMPOSE) logs -f

status:
	@echo "--- SYSTEM STATUS ---"
	@echo "Containers:"
	@docker ps -a
	@echo "Images:"
	@docker images
	@echo "Volumes:"
	@docker volume ls

gateway:
	@$(COMPOSE) exec gateway bash

users:
	@$(COMPOSE) exec users bash

frontend:
	@$(COMPOSE) exec frontend bash

nginx:
	@$(COMPOSE) exec nginx bash

re: fclean all

.PHONY: all re status build up up-no-build down reload fclean logs gateway users frontend nginx