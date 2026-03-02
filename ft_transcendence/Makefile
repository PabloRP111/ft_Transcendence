COMPOSE=docker-compose -f ./src/docker-compose.yml

all: up

build:
	@echo "🔨 Construyendo imágenes..."
	@$(COMPOSE) build

up:
	@echo "🚀 Levantando contenedores..."
	@$(COMPOSE) up --build -d

up-no-build:
	@echo "🚀 Levantando contenedores sin rebuild..."
	@$(COMPOSE) up -d
down:
	@echo "🛑 Parando contenedores..."
	@$(COMPOSE) down

reload: down up
	@echo "Recargando containers"

fclean: down
	@echo "🧨 Borrando volúmenes del proyecto..."
	@docker volume rm src_gateway_data src_users_data || true
	@echo "🧹 Borrando imágenes del proyecto..."
	@docker-compose -f ./src/docker-compose.yml build --no-cache
	@docker images -q | xargs -r docker rmi -f
	@echo "🗑 Borrando bases de datos locales..."
	@rm -f ./src/backend/micro_services/users/users.db
	@rm -f ./src/backend/gateway/src/gateway.db
	@rm -f ./src/backend/gateway/src/cookies.txt
	@echo "✅ Limpieza completa"

logs:
	$(COMPOSE) logs -f

status:
	@echo "STATUS"
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

re: fclean all logs

.PHONY: all re status build up up-no-build down reload fclean logs gateway users frontend nginx
