import { Request, Response } from 'express';
import User from '../models/User.model';
import { z } from 'zod';
import { PDFParse } from 'pdf-parse';

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
      res.status(400).json({ message: error.issues[0].message });
      return;
    }
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

export const uploadResume = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    // Extract text from the PDF buffer
    const parser = new PDFParse({ data: req.file.buffer });
    const pdfData = await parser.getText();
    
    // Clean up excessive whitespace and newlines
    let text = pdfData.text || '';
    text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    if (text.length < 50) {
      // Very little text could indicate a scanned PDF (image-based)
      res.status(422).json({ 
        message: 'This PDF appears to be a scanned image or contains too little text. Please paste your resume text manually instead.',
        code: 'SCANNED_PDF'
      });
      return;
    }

    // Return the extracted text
    res.json({ text });
  } catch (error: any) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ message: 'Failed to extract text from PDF' });
  }
};
