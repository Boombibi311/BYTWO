# BYTWO - Full Stack Node.js Application

This is a full-stack web application built with Node.js, Express, and React.

## Project Structure

- `/server` - Backend Express server
- `/client` - Frontend React application

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm run install-all
   ```
   This will install both server and client dependencies.

## Running the Application

### Development Mode

To run both server and client in development mode:
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5000
- Frontend development server on http://localhost:3000

### Running Separately

- Backend only:
  ```bash
  npm run server
  ```
- Frontend only:
  ```bash
  npm run client
  ```

### Production Build

1. Build the React application:
   ```bash
   cd client
   npm run build
   ```
2. Start the production server:
   ```bash
   npm start
   ```

## Available Scripts

- `npm start` - Run the production server
- `npm run server` - Run the backend server in development mode
- `npm run client` - Run the frontend development server
- `npm run dev` - Run both frontend and backend in development mode
- `npm run install-all` - Install all dependencies for both frontend and backend 