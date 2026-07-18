import { Request, Response } from 'express';
import User from '../models/User.model';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().optional(),
  resumeText: z.string().optional(),
});

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (validatedData.name !== undefined) user.name = validatedData.name;
    if (validatedData.resumeText !== undefined) user.resumeText = validatedData.resumeText;

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      resumeText: user.resumeText,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};
