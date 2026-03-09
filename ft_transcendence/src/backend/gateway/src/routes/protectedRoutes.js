import express from "express";

const router = express.Router();

router.get("/landing", (req, res) => {
  res.json({
    message: "Landing protegida",
    user: req.user
  });
});

router.get("/me", (req, res) => {
  res.json({
    message: "Usuario autenticado",
    user: req.user
  });
});

export default router;