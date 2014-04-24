SHELL=/bin/bash

JSHINT=./node_modules/.bin/jshint

.PHONY: all lint install

all: lint

lint:
	@$(JSHINT) .

install:
	@npm install
