FROM node:20-alpine

ENV APP_HOME=/opt/app

RUN apk add --no-cache python3 py3-pip
RUN pip3 install simplefix --break-system-packages

WORKDIR $APP_HOME

COPY loadtest-dashboard/package*.json ./loadtest-dashboard/
WORKDIR $APP_HOME/loadtest-dashboard
RUN npm ci

WORKDIR $APP_HOME
COPY loadtest-dashboard/ ./loadtest-dashboard/
COPY tests/ ./tests/

WORKDIR $APP_HOME/loadtest-dashboard

RUN sed -i "s/'--users'/'--host', 'exchange-back-end', '--port', '9876', '--users'/g" vite.config.ts

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
