// Package http provides HTTP utilities
package http

import (
	"context"
	"net/http"
	"time"
)

// Server represents an HTTP server
type Server struct {
	addr string
	handler http.Handler
	timeout time.Duration
}

// Config holds server configuration
type Config struct {
	Address string
	Port    int
	Timeout time.Duration
	TLS     *TLSConfig
}

// TLSConfig holds TLS configuration
type TLSConfig struct {
	CertFile string
	KeyFile  string
	Enabled  bool
}

// Handler is a function type for HTTP handlers
type Handler func(w http.ResponseWriter, r *http.Request) error

// Middleware is a function type for HTTP middleware
type Middleware func(next Handler) Handler

// Router interface for HTTP routing
type Router interface {
	Handle(pattern string, handler Handler)
	ServeHTTP(w http.ResponseWriter, r *http.Request)
}

// Logger interface for logging
type Logger interface {
	Info(msg string)
	Error(msg string, err error)
	Debug(msg string)
}

// NewServer creates a new Server
func NewServer(addr string, handler http.Handler) *Server {
	return &Server{
		addr:    addr,
		handler: handler,
		timeout: 30 * time.Second,
	}
}

// Start starts the HTTP server
func (s *Server) Start(ctx context.Context) error {
	srv := &http.Server{
		Addr:    s.addr,
		Handler: s.handler,
	}

	go func() {
		<-ctx.Done()
		srv.Shutdown(context.Background())
	}()

	return srv.ListenAndServe()
}

// Stop stops the HTTP server
func (s *Server) Stop() error {
	// Implementation here
	return nil
}

// SetTimeout sets the server timeout
func (s *Server) SetTimeout(timeout time.Duration) {
	s.timeout = timeout
}

// GetAddress returns the server address
func (s *Server) GetAddress() string {
	return s.addr
}

// WithLogging is middleware that adds logging
func WithLogging(logger Logger) Middleware {
	return func(next Handler) Handler {
		return func(w http.ResponseWriter, r *http.Request) error {
			logger.Info("Request: " + r.URL.Path)
			err := next(w, r)
			if err != nil {
				logger.Error("Error: ", err)
			}
			return err
		}
	}
}

// WithTimeout is middleware that adds timeout
func WithTimeout(timeout time.Duration) Middleware {
	return func(next Handler) Handler {
		return func(w http.ResponseWriter, r *http.Request) error {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			r = r.WithContext(ctx)
			return next(w, r)
		}
	}
}

// ParseConfig parses configuration
func ParseConfig(data []byte) (*Config, error) {
	// Implementation here
	return nil, nil
}

// ValidateConfig validates configuration
func ValidateConfig(config *Config) error {
	// Implementation here
	return nil
}

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	return &Config{
		Address: "localhost",
		Port:    8080,
		Timeout: 30 * time.Second,
		TLS:     nil,
	}
}

// StatusCode represents HTTP status codes
type StatusCode int

const (
	StatusOK StatusCode = 200
	StatusCreated StatusCode = 201
	StatusBadRequest StatusCode = 400
	StatusNotFound StatusCode = 404
	StatusInternalError StatusCode = 500
)
