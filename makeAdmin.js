/**
 * makeAdmin.js — One-time script to promote a user to admin by email.
 * Usage: node makeAdmin.js <email>
 * Example: node makeAdmin.js admin@example.com
 */

const mongoose = require("mongoose");
require("dotenv").config();

const email = process.argv[2];

if (!email) {
  console.error("❌  Usage: node makeAdmin.js <email>");
  process.exit(1);
}

const userSchema = new mongoose.Schema({ name: String, email: String, role: String, isBanned: Boolean }, { strict: false });
const User = mongoose.model("User", userSchema);

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅  Connected to MongoDB");

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.error(`❌  No user found with email: ${email}`);
      process.exit(1);
    }

    user.role = "admin";
    await user.save();

    console.log(`\n🎉  SUCCESS! "${user.name}" (${user.email}) is now an ADMIN.\n`);
    console.log("   You can now log in with these credentials and access /admin\n");
  } catch (err) {
    console.error("❌  Error:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
