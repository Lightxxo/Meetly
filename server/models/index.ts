import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import UserModel from "./User";
import EventTypeModel from "./EventType";
import EventModel from "./Event";
import EventCommentModel from "./EventComment";
import EventAttendanceModel from "./EventAttendance";
import EventImageModel from "./EventImage";
import EventTypeOfEventModel from "./EventTypeOfEvent";
const fs = require('fs');
const path = require('path');
dotenv.config();

// ✅ Initialize Sequelize
const sequelize = new Sequelize({
  dialect: "postgres",
  database: process.env.POSTGRESQL_DATABASE!,
  username: process.env.POSTGRESQL_USER!,
  password: process.env.POSTGRESQL_PASSWORD!,
  host: process.env.POSTGRESQL_HOST!,
  port: parseInt(process.env.POSTGRESQL_PORT!),
  logging: false,
  pool: {
    max: 80,         // Maximum number of connections in the pool
    min: 0,          // Minimum number of connections in the pool
    acquire: 300000000,  // Time in milliseconds before a connection is considered to be timed out
    idle: 10000,     // Time in milliseconds before an unused connection is released
  },
});

// ✅ Define Models
const db = {
  sequelize,
  User: UserModel(sequelize),
  EventType: EventTypeModel(sequelize),
  Event: EventModel(sequelize),
  EventComment: EventCommentModel(sequelize),
  EventAttendance: EventAttendanceModel(sequelize),
  EventImage: EventImageModel(sequelize),
  EventTypeOfEvent: EventTypeOfEventModel(sequelize),
};

// Associations

// User - Event (One-to-Many)
db.User.hasMany(db.Event, { foreignKey: "hostID", onDelete: "CASCADE" });
db.Event.belongsTo(db.User, { foreignKey: "hostID", onDelete: "CASCADE" });

// Event - EventComment (One-to-Many)
db.Event.hasMany(db.EventComment, { foreignKey: "eventID", onDelete: "CASCADE" });
db.EventComment.belongsTo(db.Event, { foreignKey: "eventID", onDelete: "CASCADE" });

// User - EventComment (One-to-Many)
db.User.hasMany(db.EventComment, { foreignKey: "userID", onDelete: "CASCADE" });
db.EventComment.belongsTo(db.User, { foreignKey: "userID", onDelete: "CASCADE" });

// Event - EventAttendance (One-to-Many)
db.Event.hasMany(db.EventAttendance, { foreignKey: "eventID", onDelete: "CASCADE" });
db.EventAttendance.belongsTo(db.Event, { foreignKey: "eventID", onDelete: "CASCADE" });

// User - EventAttendance (One-to-Many)
db.User.hasMany(db.EventAttendance, { foreignKey: "userID", onDelete: "CASCADE" });
db.EventAttendance.belongsTo(db.User, { foreignKey: "userID", onDelete: "CASCADE" });

// Event - EventImage (One-to-Many)
db.Event.hasMany(db.EventImage, { foreignKey: "eventID", onDelete: "CASCADE" });
db.EventImage.belongsTo(db.Event, { foreignKey: "eventID", onDelete: "CASCADE" });

// ✅ Correct Many-to-Many Relationship: Event <-> EventType
db.Event.belongsToMany(db.EventType, { 
  through: db.EventTypeOfEvent, 
  foreignKey: "eventID", 
  onDelete: "CASCADE",
});

db.EventType.belongsToMany(db.Event, { 
  through: db.EventTypeOfEvent, 
  foreignKey: "eventTypeID", 
  onDelete: "NO ACTION",
});

// ✅ Fix: Explicitly Associate EventTypeOfEvent with Event & EventType
db.Event.hasMany(db.EventTypeOfEvent, { foreignKey: "eventID", onDelete: "CASCADE" });
db.EventTypeOfEvent.belongsTo(db.Event, { foreignKey: "eventID" });

db.EventType.hasMany(db.EventTypeOfEvent, { foreignKey: "eventTypeID", onDelete: "CASCADE" });
db.EventTypeOfEvent.belongsTo(db.EventType, { foreignKey: "eventTypeID" });



// Define the global force variable
let force = false; // 

const syncDatabase = async () => {
  try {
    // If force is true, delete all images in ./uploads/events/
    if (force) {
      const directoryPath = path.join(__dirname, '../uploads/events/');

      // Check if the directory exists
      if (fs.existsSync(directoryPath)) {
        const files = fs.readdirSync(directoryPath);

        // Delete all files in the directory
        files.forEach((file:any) => {
          const filePath = path.join(directoryPath, file);
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath); // Delete file
            console.log(`Deleted ${file}`);
          }
        });
      } else {
        console.log('Directory does not exist.');
      }
    }

    // Synchronize the database, passing the global force variable
    await sequelize.sync({ alter: true, force });

    // Ensure createdAt index exists
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_createdAt ON "Events"("createdAt");`
    );

    console.log("✅ Database synchronized successfully.");
  } catch (error) {
    console.error("❌ Database synchronization failed:", error);
  }
};


force = true; 
syncDatabase();


export default db;
