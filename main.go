package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	log.SetOutput(os.Stdout)
	log.Println("Starting GarnetAI Event Generator")

	// Get environment variables
	token := os.Getenv("GARNETAI_API_TOKEN")
	apiURL := os.Getenv("GARNETAI_API_URL")

	if token == "" {
		log.Fatal("GARNETAI_API_TOKEN environment variable is required")
	}

	if apiURL == "" {
		apiURL = "https://api.garnet.ai"
		log.Printf("Using default API URL: %s", apiURL)
	} else {
		log.Printf("Using API URL: %s", apiURL)
	}

	// Set up event_generator
	binPath, err := setupEventGenerator()
	if err != nil {
		log.Fatal("Failed to set up event generator: ", err)
	}

	// Run the event generator
	err = runEventGenerator(binPath, token, apiURL)
	if err != nil {
		log.Fatal("Failed to run event generator: ", err)
	}

	log.Println("GarnetAI event generator started successfully")
}

func setupEventGenerator() (string, error) {
	// Copy event_generator to /usr/local/bin
	srcPath := "./event_generator"
	destDir := "/usr/local/bin"
	destPath := filepath.Join(destDir, "event_generator")

	// Check if the file already exists and remove it
	if _, err := os.Stat(destPath); err == nil {
		os.Remove(destPath)
	}

	// Create destination directory if it doesn't exist
	if _, err := os.Stat(destDir); os.IsNotExist(err) {
		err = os.MkdirAll(destDir, 0755)
		if err != nil {
			return "", fmt.Errorf("failed to create directory: %v", err)
		}
	}

	// Copy the file
	source, err := os.ReadFile(srcPath)
	if err != nil {
		return "", fmt.Errorf("failed to read source file: %v", err)
	}

	err = os.WriteFile(destPath, source, 0755)
	if err != nil {
		return "", fmt.Errorf("failed to write destination file: %v", err)
	}

	log.Printf("Event generator installed to: %s", destPath)
	return destPath, nil
}

func runEventGenerator(binPath, token, apiURL string) error {
	// Run the event generator with token and URL parameters
	cmd := exec.Command(binPath, "-token", token, "-url", apiURL)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	// Start the process
	err := cmd.Start()
	if err != nil {
		return fmt.Errorf("failed to start event generator: %v", err)
	}

	// Don't wait for it to complete, let it run in the background
	log.Printf("Event generator process started with PID: %d", cmd.Process.Pid)
	
	return nil
}