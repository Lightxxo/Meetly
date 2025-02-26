import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize({
  dialect: "postgres",
  database: process.env.POSTGRESQL_DATABASE!,
  username: process.env.POSTGRESQL_USER!,
  password: process.env.POSTGRESQL_PASSWORD!,
  host: process.env.POSTGRESQL_HOST!,
  port: parseInt(process.env.POSTGRESQL_PORT!),
  logging: false,
  pool: {
    max: 80,
    min: 0,
    acquire: 300000000,
    idle: 10000,
  },
});

// Non-sharded models
import UserModel from "./User";
import EventTypeModel from "./EventType";
const User = UserModel(sequelize);
const EventType = EventTypeModel(sequelize);

// Sharded models factory functions
import EventModel from "./Event";
import EventAttendanceModel from "./EventAttendance";
import EventCommentModel from "./EventComment";
import EventImageModel from "./EventImage";
import EventTypeOfEventModel from "./EventTypeOfEvent";

// We use 20 shards for the high-traffic tables
const NUM_SHARDS = 20;
const sharded:any = {
  Event: {} as { [key: number]: ReturnType<typeof EventModel> },
  EventAttendance: {} as { [key: number]: ReturnType<typeof EventAttendanceModel> },
  EventComment: {} as { [key: number]: ReturnType<typeof EventCommentModel> },
  EventImage: {} as { [key: number]: ReturnType<typeof EventImageModel> },
  EventTypeOfEvent: {} as { [key: number]: ReturnType<typeof EventTypeOfEventModel> },
};

for (let i = 0; i < NUM_SHARDS; i++) {
  // Pass the shard index (as string) to append to the table name
  sharded.Event[i] = EventModel(sequelize, i.toString());
  sharded.EventAttendance[i] = EventAttendanceModel(sequelize, i.toString());
  sharded.EventComment[i] = EventCommentModel(sequelize, i.toString());
  sharded.EventImage[i] = EventImageModel(sequelize, i.toString());
  sharded.EventTypeOfEvent[i] = EventTypeOfEventModel(sequelize, i.toString());
}

// Helper function to calculate shard index based on an ID (using a simple hash)
export const getShardIndex = (id: string): number => {
  const numericID = BigInt("0x" + id.replace(/-/g, ""));
  return Number(numericID % BigInt(NUM_SHARDS));
};

// Helper to get the correct sharded model instance.
// modelName must be one of: 'Event', 'EventAttendance', 'EventComment', 'EventImage', or 'EventTypeOfEvent'
export const getShardedModel = (modelName: string, id: string) => {
  const shardIndex = getShardIndex(id);
  return sharded[modelName][shardIndex];
};

const db = {
  sequelize,
  User,
  EventType,
  sharded, // contains all sharded models by table name and shard index
  getShardedModel,
  getShardIndex,
};

export default db;
