package controlplane

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Policy struct {
	Public               bool     `json:"public"`
	MaxConcurrentViewers int      `json:"maxConcurrentViewers"`
	BlockPaths           []string `json:"blockPaths"`
	Password             string   `json:"password"`
}

type Viewer struct {
	ID         string `json:"id"`
	LastSeenAt string `json:"lastSeenAt"`
	Requests   int    `json:"requests"`
	IP         string `json:"ip,omitempty"`
}

type Session struct {
	OwnerURL        string   `json:"ownerUrl"`
	Policy          Policy   `json:"policy"`
	KickedViewerIDs []string `json:"kickedViewerIds"`
	ActiveViewers   []Viewer `json:"activeViewers"`
	Closed          bool     `json:"closed"`
}

type Client struct {
	baseURL     string
	internalKey string
	httpClient  *http.Client
}

func New(baseURL, internalKey string) *Client {
	return &Client{
		baseURL:     strings.TrimRight(baseURL, "/"),
		internalKey: internalKey,
		httpClient:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (client *Client) request(method, path string, body any) (*http.Response, error) {
	var requestBody bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&requestBody).Encode(body); err != nil {
			return nil, err
		}
	}
	request, err := http.NewRequest(method, client.baseURL+path, &requestBody)
	if err != nil {
		return nil, err
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if client.internalKey != "" {
		request.Header.Set("Authorization", "Bearer "+client.internalKey)
	}
	return client.httpClient.Do(request)
}

func (client *Client) FetchSession(slug string) (Session, int, error) {
	if client.baseURL == "" {
		return Session{}, 0, fmt.Errorf("control plane url is empty")
	}
	response, err := client.request(http.MethodGet, "/internal/sessions/by-slug/"+slug, nil)
	if err != nil {
		return Session{}, 0, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return Session{}, response.StatusCode, nil
	}
	var session Session
	if err := json.NewDecoder(response.Body).Decode(&session); err != nil {
		return Session{}, response.StatusCode, err
	}
	return session, response.StatusCode, nil
}

func (client *Client) ValidateSession(sessionToken string) (int, error) {
	response, err := client.request(http.MethodPost, "/internal/sessions/validate", map[string]string{"sessionToken": sessionToken})
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()
	return response.StatusCode, nil
}

func (client *Client) Post(path string, body any) error {
	response, err := client.request(http.MethodPost, path, body)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("control plane returned %s", response.Status)
	}
	return nil
}
