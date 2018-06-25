FROM golang:1.10-alpine

# Go dep!
# RUN go get github.com/golang/dep/cmd/dep
RUN apk add --update curl git && \
    rm -rf /var/cache/apk/*
RUN curl https://raw.githubusercontent.com/golang/dep/master/install.sh | sh

# Set go bin which doesn't appear to be set already.
ENV GOBIN /go/bin

# create directories
RUN mkdir /app
RUN mkdir /go/src/app
WORKDIR /go/src/app

CMD ["/app/main"]