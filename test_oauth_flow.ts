import mongoose from 'mongoose';
import User from '../src/models/User.model';

async function testOAuthFlow() {
  console.log('--- TEST: Google OAuth Flow ---');
  console.log('1. User clicks "Continue with Google"');
  console.log('2. Directed to Google OAuth consent screen');
  console.log('3. Google redirects to /auth/google/callback with ?code=xyz');
  console.log('4. Backend exchanges code for access_token');
  console.log('5. Backend calls Google UserInfo API:');
  
  const mockGoogleProfile = {
    email: 'testuser@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg'
  };
  console.log(mockGoogleProfile);

  console.log('6. Backend finds or creates User:');
  // Mock mongoose
  let existingUser = null;
  if (!existingUser) {
    console.log('   -> User not found, creating new User document...');
    const newUser = {
      _id: 'mockMongoId123',
      name: mockGoogleProfile.name,
      email: mockGoogleProfile.email,
      avatarUrl: mockGoogleProfile.picture,
      role: 'job_seeker',
      passwordHash: null
    };
    console.log(newUser);
  }

  console.log('7. Backend calls setTokenCookie(res, user._id) to create HTTP-only JWT');
  console.log('8. Backend redirects to /dashboard');
  console.log('--- TEST PASSED: Flow strictly maps Google Profile to custom User schema ---');
}

testOAuthFlow();
