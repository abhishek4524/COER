import { Router } from 'express';
import Persona from '../models/Persona.js';

const router = Router();

// GET /api/personas
router.get('/', async (req, res, next) => {
  try {
    const { search, tag, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (tag) filter['traits.ageGroup'] = tag;

    const personas = await Persona.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Persona.countDocuments(filter);

    res.json({ success: true, data: personas, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
});

// GET /api/personas/:id
router.get('/:id', async (req, res, next) => {
  try {
    const persona = await Persona.findById(req.params.id);
    if (!persona) return res.status(404).json({ success: false, error: 'Persona not found' });
    res.json({ success: true, data: persona });
  } catch (err) {
    next(err);
  }
});

// POST /api/personas
router.post('/', async (req, res, next) => {
  try {
    const persona = await Persona.create(req.body);
    res.status(201).json({ success: true, data: persona });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personas/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const persona = await Persona.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!persona) return res.status(404).json({ success: false, error: 'Persona not found' });
    res.json({ success: true, data: persona });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/personas/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const persona = await Persona.findByIdAndDelete(req.params.id);
    if (!persona) return res.status(404).json({ success: false, error: 'Persona not found' });
    res.json({ success: true, message: 'Persona deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
