# Meetly 🚀

Meetly is a full‐stack application inspired by Meetup.com, enabling users to create and manage events, RSVP, and discover events. It features a robust backend and a dynamic React frontend for seamless event management. Project Demo:

[![Demo](https://img.youtube.com/vi/B3TABKQgHHw/0.jpg)](https://www.youtube.com/watch?v=B3TABKQgHHw)


---

## Table of Contents
- [Features](#features-)
- [Project Structure](#project-structure-)
- [Tech Stack](#tech-stack-)
- [Setup and Installation](#setup-and-installation-)
- [Usage](#usage-)
- [Sample Data Testing](#sample-data-testing-)
- [Possible Improvements](#possible-improvements-)
- [Contributing](#contributing-)
- [License](#license-)
- [Acknowledgments](#acknowledgments-)

---

## Features ✨

- **User Authentication** 🔐  
  Secure sign‐up, login, and profile management.

- **Event Management** 📅  
  Create, update, and delete events.

- **RSVP System** ✅  
  Easily RSVP to events and view attendee lists.

- **Search & Discovery** 🔍  
  Find events based on interests and location.

- **Sample Data Endpoint** ⚙️  
  Generate large volumes of test data to simulate real‐world scenarios.

---

## Project Structure 📂
```text
Meetly/
├── public/          # Static assets and HTML files
├── src/             # Frontend source code (React & Tailwind CSS)
├── server/          # Backend server code (Express.js & PostgreSQL)
│   ├── controllers/ # Controller files (including sample data logic)
│   ├── routes/      # Route definitions directing endpoints (e.g., /sample-data)
│   └── ...          # Additional backend configuration files (ESLint, etc.)
├── .gitignore       # Git ignore rules
├── README.md        # This README file
├── package.json     # Project metadata and scripts
├── tsconfig.json    # TypeScript configuration
├── vite.config.ts   # Vite configuration for development
└── ...              # Other configuration files
```
---

## Tech Stack 🛠️

**Frontend:**  
- **React.js** ⚛️ – For building interactive user interfaces.  
- **Tailwind CSS** 🎨 – Utility‐first CSS framework for rapid styling.

**Backend:**  
- **Node.js** & **Express.js** 🚀 – Server‐side framework powering the API.  
- **PostgreSQL** 🗄️ – SQL database for structured data storage.

**Authentication:**  
- **JWT (JSON Web Tokens)** 🔑 – Secure authentication and authorization.

---

## Setup and Installation ⚙️

1. **Clone the Repository:**  
    git clone https://github.com/Lightxxo/Meetly.git

2. **Install Dependencies:**  
   **Frontend:**  
        cd Meetly  
        npm install  

   **Backend:**  
        cd server  
        npm install  

3. **Configure Environment Variables:**  
   - Create a `.env` file in the root directory (and in the `server` folder if required).  
   - Add necessary variables (e.g., PostgreSQL connection URI, JWT secret).

4. **Run the Application:**  
   **Frontend:**  
        npm run dev  

   **Backend (in a separate terminal):**  
        cd server  
        npm run dev  

   *Tip: Use [nodemon](https://nodemon.io/) for automatic server restarts during development.*

---

## Usage 🎮

- **Sign Up / Login:**  
  Create an account or log in to start managing and exploring events.

- **Event Operations:**  
  Create, update, or delete events as needed. The RSVP system lets users join events effortlessly.

- **Search & Discovery:**  
  Use the search functionality to quickly find events that match your interests and location.

---

## Sample Data Testing 📊

Meetly includes a dedicated endpoint for populating the database with test data. This feature is especially useful for performance testing, stress testing, and simulating real‐world data volumes.

### Endpoint Details

- **URL:** /sample-data  
- **Method:** POST  
- **Purpose:** To generate interconnected sample records (events, comments, images, RSVPs) in the database.

### Request Payload

    {
      "n": 20,
      "m": 1000
    }

- **`n` (Initial Count):**  
  This sets the baseline number of records. It should typically be set to **20**.

- **`m` (Final Count):**  
  Determines how many records to create. For example, setting `m` to **1000000** will generate 1,000,000 entries, which is useful for testing the system under heavy load.

### How It Works

- **Routing:**  
  The application's router directs any POST requests to `/sample-data` to the designated controller.

- **Controller Processing:**  
  The controller interprets the values of `n` and `m`, and then sequentially generates a series of sample records—including events, comments, images, and RSVP entries—to simulate a populated environment.

- **Use Case:**  
  This endpoint is ideal for developers who need to verify application performance, test data integrity, or simulate heavy traffic scenarios in development or testing environments.  

**Note:** It is recommended to use this endpoint only in non‐production settings as massive data generation can significantly impact performance.

---

## Possible Improvements 🚧

- [ ] **Enhanced Event Details:** Introduce more detailed event descriptions and multimedia support.  
- [ ] **UI/UX Refinements:** Continuous improvements to the user interface and overall experience.  
- [ ] **Performance Optimizations:** Further optimization of data handling, database optimizations and sample data generation.

---

## Contributing 🤝

Contributions are welcome! To contribute:

1. **Fork** this repository.  
2. **Create a New Branch** for your feature or bug fix:  
       git checkout -b feature/your-feature-name  
3. **Commit** your changes:  
       git commit -m "Add: brief description of changes"  
4. **Push** to your branch:  
       git push origin feature/your-feature-name  
5. **Open a Pull Request** with a detailed description of your changes.

For major changes, please open an issue first to discuss what you would like to change.

---

## License 📄

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgments 🙏

- **Inspired by:**  
  [Meetup.com](https://www.meetup.com) for its innovative approach to community building.

- **Special Thanks:**  
  The open‐source community and all contributors who continuously help improve Meetly.

---

*Happy Coding! 💻✨*
