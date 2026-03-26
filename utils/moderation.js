const Notification = require("../models/Notification");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const adjustTrustScore = async (userId, delta) => {
  if (!userId || !delta) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  user.trustScore = clamp((user.trustScore || 0) + delta, 0, 100);
  await user.save();
  return user;
};

const getTrustLevel = (trustScore = 0) => {
  if (trustScore >= 80) return "Trusted";
  if (trustScore >= 40) return "Neutral";
  return "Risky";
};

const notifyAdmins = async ({ message, io, type = "system" }) => {
  const admins = await User.find({ role: "admin", isBanned: false }).select("_id");
  if (!admins.length) return [];

  const notifications = await Notification.insertMany(
    admins.map((admin) => ({
      userId: admin._id,
      message,
      type,
    }))
  );

  if (io) {
    notifications.forEach((notification) => {
      io.to(notification.userId.toString()).emit("new notification", notification);
    });
  }

  return notifications;
};

const logModerationAction = async ({ actorId = null, action, targetType, targetId = null, details = "" }) => {
  return ActivityLog.create({
    actorId,
    action,
    targetType,
    targetId,
    details,
  });
};

module.exports = {
  adjustTrustScore,
  getTrustLevel,
  notifyAdmins,
  logModerationAction,
};
