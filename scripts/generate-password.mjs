import bcrypt from 'bcryptjs';
import { createInterface } from 'readline';

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter password to hash: ', async (password) => {
  if (!password || password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  console.log('Hashing (this takes a few seconds with 12 rounds)...');
  const hash = await bcrypt.hash(password, 12);
  console.log('\nAdd these to your .env.local and Railway variables:\n');
  console.log(`ADMIN_USERNAME=admin`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  rl.close();
});
