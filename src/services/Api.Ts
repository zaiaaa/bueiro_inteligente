import axios from "axios";

const api = axios.create({
  baseURL: "http://192.168.0.235:8081",
  headers: {
    "Content-Type": "application/json",
  },
});

export { api };

