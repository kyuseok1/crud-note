require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const PORT = 5000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
const SECRET_KEY = process.env.SECRET_KEY;

// MongoDB 연결
mongoose.connect(
  "mongodb+srv://llv7417:whrbtjr123@cluster0.wewyamo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// 스키마와 모델 설정
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: String,
});

const noteSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  content: String,
  date: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Note = mongoose.model("Note", noteSchema);

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  console.log("Authorization Header:", authHeader);
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err)
      return res.status(401).json({ message: "Failed to authenticate token" });
    req.userId = decoded.userId;
    next();
  });
};
// CRUD 라우트
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 로그인 API
app.post("/login", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, SECRET_KEY, {
      expiresIn: "1h",
    });
    res.json({ token, name: user.name });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password"); // 비밀번호 제외
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/notes", authMiddleware, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.userId });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/notes", authMiddleware, async (req, res) => {
  const note = new Note({
    title: req.body.title,
    content: req.body.content,
    userId: req.userId, // 사용자 ID를 노트와 함께 저장
  });
  await note.save();
  res.send(note);
});

app.put("/notes/:id", authMiddleware, async (req, res) => {
  const { title, content } = req.body;
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { title, content },
    { new: true }
  );
  res.json(note);
});

app.delete("/notes/:id", authMiddleware, async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.send({ message: "Note deleted" });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
