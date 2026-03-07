FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /event-gateway ./cmd/event-gateway

FROM alpine:3.20

RUN apk --no-cache add ca-certificates

COPY --from=builder /event-gateway /usr/local/bin/event-gateway

EXPOSE 8090

ENTRYPOINT ["event-gateway"]
