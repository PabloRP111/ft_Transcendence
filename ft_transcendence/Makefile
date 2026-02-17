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
own:
	@echo "🛑 Parando contenedores..."
	@$(COMPOSE) down

clean: down
	@echo "🧹 Contenedores parados (clean no borra volúmenes)"
	@echo "Use 'make fclean' para borrar también volúmenes"

fclean: down
	@echo "🧨 Borrando contenedores, imágenes y volúmenes..."
	@docker system prune -af --volumes
	@rm -rf ./src/backend/micro_services/users/users.db

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

.PHONY: all re status build up up-no-build down clean fclean logs gateway users frontend nginx
