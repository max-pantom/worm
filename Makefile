.PHONY: install dev gateway control-plane cli test

install:
	cd packages/cli && npm install
	cd packages/control-plane && npm install
	cd packages/gateway && go mod download

build:
	cd packages/cli && npm run build
	cd packages/control-plane && npm run build

gateway:
	cd packages/gateway && go run .

control-plane:
	cd packages/control-plane && npm run dev

cli:
	cd packages/cli && npm run dev -- http 3000
