import express from "express";
import cors from "cors";
import gameRoutes from "./routes/gameRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/game", gameRoutes);

const PORT = process.env.PORT || 2077;
app.listen(PORT, () => {
  console.log(`Game microservice running on port ${PORT}`);
});