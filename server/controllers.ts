import { Request, Response } from "express";
import db from "./models";
import dotenv from "dotenv";
import { ControllerType } from "./types/controller";
import { Op } from "sequelize";
import { hashPassword, comparePassword } from "./utils/hashing";
import jwt from "jsonwebtoken";
import path from "path";
import randomData from "./randomData";
import fs from "fs"
import { promises as fsPromises } from 'fs';
import pLimit from 'p-limit';
import pidusage from 'pidusage';
import os from "os";
import { faker, tr } from '@faker-js/faker';
import  { getShardedModel } from './models';

const usedAdjectives = new Set();

const getUniqueAdjective = () => {
    if (usedAdjectives.size === 500) usedAdjectives.clear(); 
    
    let adjective;
    do {
        adjective = faker.word.adjective(); 
    } while (usedAdjectives.has(adjective)); 

    usedAdjectives.add(adjective); 
    return adjective.charAt(0).toUpperCase() + adjective.slice(1);
};






dotenv.config();

const controller: ControllerType = {};

const JWT_SECRET = process.env.JWT_SECRET_KEY!;
const JWT_EXPIRE = "1h";

const BASE_URL = "http://localhost:3000";

controller.testDbConnectionController = async (req: Request, res: Response) => {
  try {
    await db.sequelize.authenticate();
    res.status(200).send("Database connection successful!");
  } catch (error: any) {
    res.status(500).send("Unable to connect to the database: " + error.message);
  }
};

controller.testServerUpController = async (req: Request, res: Response) => {
  res.send("Meetly Server up and running!!");
};

controller.signupController = async (req: Request, res: Response) => {
  const { username, email, password } = req.body[0];
  const hashedPassword = await hashPassword(password);

  try {
    const [user, created] = await db.User.findOrCreate({
      where: {
        [Op.or]: [{ username }, { email }],
      },
      defaults: {
        username: username,
        password: hashedPassword,
        email: email,
      },
    });

    if (created) {
      const token = jwt.sign({ id: user.dataValues.userID }, JWT_SECRET, {
        expiresIn: JWT_EXPIRE,
      });

      res.status(201).json({
        ...user.dataValues,
        token: token,
      });
      console.log("User Signed Up!", user.dataValues);
    } else {
      res.status(409).json({ error: "User Credentials In Use", user: user });
      console.log("User Sign up Failed, Credentials In Use", user.dataValues);
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Error while signing up", message: error.message });
  }
};

controller.loginController = async (req: Request, res: Response) => {
  const { email, password } = req.body[0];

  try {
    const user = await db.User.findAll({
      where: {
        email: email,
      },
    });

    if (user.length) {
      console.log(
        `Login request received, DB replied with user: ${
          user[0].dataValues.userID
        } OF TYPE: ${typeof user}`
      );
      const isValidPassword = await comparePassword(
        password,
        user[0].dataValues.password
      );
      if (isValidPassword) {
        const token = jwt.sign({ id: user[0].dataValues.userID }, JWT_SECRET, {
          expiresIn: JWT_EXPIRE,
        });

        res.status(201).json({
          ...user[0].dataValues,
          token: token,
        });
        return;
      } else {
        res.status(401).json({ error: "Invalid Login, Password mismatch" });
        return;
      }
    } else {
      res.status(401).json({ error: "Invalid Login, E-mail not found" });
    }
  } catch (e: any) {
    console.log(
      `Encountered error on LOGIN API when getting response back from server: ${e.message}`
    );
    res
      .status(500)
      .json({ error: "Internal Server Error", message: e.message });
  }
};

controller.userTokenVerifyController = async (req: Request, res: Response) => {
  const tok = req.headers["token"] as string;

  // if (!tok || !tok.startsWith('Bearer ')) {
  //   return res.status(400).json({ error: "Token not provided or invalid format" });
  // }

  const token = tok.split(" ")[1];

  try {
    jwt.verify(token, JWT_SECRET!);
    const decoded = jwt.decode(token);

    if (decoded && typeof decoded !== "string") {
      const user = await db.User.findAll({
        where: {
          userID: decoded.id,
        },
      });
      if (user && decoded.id === user[0].dataValues.userID) {
        res.status(201).json({ validator: true });
        return;
      } else {
        res.status(401).json({
          error: "Decoded User not matching User ID IN DB OR USER NOT FOUND",
        });

        return;
      }
    } else {
      console.log("Invalid token");
      res.status(402).json({ error: "Invalid Token" });
      return;
    }
  } catch (e: any) {
    console.log(`Encountered error on USER TOKEN VERIFY API: ${e.message}`);
    res
      .status(403)
      .json({ error: "Unauthorized or expired token", message: e.message });
    return;
  }
};

controller.createEventController = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    console.log("----- createEventController invoked -----");

    /** Extract Authenticated User */
    const user = req.user; // Authenticated user from authMiddleware

    /** Extract Fields from Body & Files */
    const {
      eventTitle,
      description,
      location,
      eventDate,
      thumbnailIndex,
      eventTypes,
    } = req.body;
    const files: any = req.files;
    console.log("Request body:", req.body);
    console.log("Files received:", files);

    /** Validate Inputs */
    const errors: string[] = [];
    if (!eventTitle) errors.push("Event title is required.");
    if (!description) errors.push("Description is required.");
    if (!location) errors.push("Location is required.");
    if (!eventDate) errors.push("Event date is required.");

    let eventTypesArr: any;
    try {
      eventTypesArr =
        typeof eventTypes === "string" ? JSON.parse(eventTypes) : eventTypes;
    } catch (e) {
      errors.push("Invalid format for event types.");
    }
    if (
      !eventTypesArr ||
      !Array.isArray(eventTypesArr) ||
      eventTypesArr.length === 0
    ) {
      errors.push("At least one event type is required.");
    }
    if (!files || files.length === 0) {
      errors.push("At least one event image is required.");
    }
    if (
      thumbnailIndex === undefined ||
      isNaN(thumbnailIndex) ||
      parseInt(thumbnailIndex, 10) >= files.length
    ) {
      errors.push("Invalid or missing thumbnail index.");
    }
    if (errors.length > 0) {
      console.error("Validation errors:", errors);
      res.status(400).json({ error: errors.join(", ") });
      return;
    }

    /** Generate Full Image URLs */
    const imageUrls = files.map(
      (file: any) => `${BASE_URL}/uploads/events/${file.filename}`
    );

    /** Create the Event */
    const newEvent: any = await db.Event.create({
      hostID: user.userID,
      eventTitle,
      description,
      location,
      eventDate,
      thumbnail: imageUrls[parseInt(thumbnailIndex, 10)], // Save full URL as thumbnail
    });
    console.log("New event created:", newEvent);
    const eventID = newEvent.eventID;

    /** Store Event Images in DB */
    const eventImagesData = imageUrls.map((url: string) => ({
      eventID,
      image: url,
    }));
    const imagesResult = await db.EventImage.bulkCreate(eventImagesData);

    /** Store Event Types in DB */
    const eventTypesData: any[] = [];
    for (const typeName of eventTypesArr) {
      const [eventType]: any = await db.EventType.findOrCreate({
        where: { eventType: typeName },
        defaults: { eventType: typeName },
      });
      if (!eventType.eventTypeID) {
        console.error("Event type not created properly for:", typeName);
      }
      eventTypesData.push({ eventID, eventTypeID: eventType.eventTypeID });
    }
    const eventTypesResult = await db.EventTypeOfEvent.bulkCreate(
      eventTypesData
    );

    /** Add Host as Attendee */
    const attendeeResult = await db.EventAttendance.create({
      eventID,
      userID: user.userID,
      status: "Going",
    });

    /** Return Success Response */
    res
      .status(201)
      .json({ event: newEvent, message: "Event created successfully!" });
    console.log("----- createEventController completed successfully -----");
  } catch (error: any) {
    console.error("Error in createEventController:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

controller.getEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("----- getPaginatedEvents invoked -----");

    // Parse limit and offset from query params, default to 9 events per request
    const limit = parseInt(req.query.limit as string) || 9;
    const offset = parseInt(req.query.offset as string) || 0; // Defaults to 0 if not provided

    // Fetch events sorted by createdAt (newest first), with limit & offset
    const events = await db.Event.findAll({
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // total count of events for frontend pagination
    const totalEvents = await db.Event.count();

    console.log(
      `Events retrieved: ${events.length}, Offset: ${offset}, Total: ${totalEvents}`
    );

    res.status(200).json({
      events,
      totalEvents,
      hasMore: offset + events.length < totalEvents,
    });
  } catch (error: any) {
    console.error("Error in getPaginatedEvents:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

const fetchEventDetails = async (eventID: string) => {
  try {
    const event: any = await db.Event.findOne({
      where: { eventID },
      attributes: [
        "eventID",
        "hostID",
        "eventTitle",
        "description",
        "thumbnail",
        "location",
        "eventDate",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!event) {
      throw new Error("Event not found");
    }

    // Fetch host, images, attendees, counts, and comments in parallel
    const [host, images, attendees, goingCount, interestedCount, comments] =
      await Promise.all([
        db.User.findOne({
          where: { userID: event.hostID },
          attributes: ["userID", "username"],
        }),

        db.EventImage.findAll({
          where: { eventID },
          attributes: ["image"],
        }),

        db.EventAttendance.findAll({
          where: { eventID, status: "Going" },
          include: {
            model: db.User,
            attributes: ["userID", "username", "email"],
          },
        }),

        db.EventAttendance.count({ where: { eventID, status: "Going" } }),
        db.EventAttendance.count({ where: { eventID, status: "Interested" } }),

        db.EventComment.findAll({
          where: { eventID },
          attributes: ["commentID", "username", "userID", "rating", "comment", "createdAt"],
        }),
      ]);

    // Fetch event types
    const eventTypes = await db.EventTypeOfEvent.findAll({
      where: { eventID },
      include: {
        model: db.EventType,
        attributes: ["eventType"], // Fetch only the event type name
      },
    });

    // Extract event type names
    const eventTypeNames = eventTypes.map((et: any) => et.EventType?.eventType);

    return {
      event,
      host,
      images,
      attendees,
      goingCount,
      interestedCount,
      comments,
      eventTypes: eventTypeNames,
    };
  } catch (error: any) {
    throw new Error(`Error fetching event details: ${error.message}`);
  }
};
controller.getEventDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("----- getEventDetails invoked -----");

    const { eventID } = req.params;

    if (!eventID) {
      console.error("Event ID is missing.");
      res.status(400).json({ error: "Event ID is required" });
      return;
    }

    // Fetch event details and event types in parallel
    const [eventDetails, eventTypes]: any = await Promise.all([
      fetchEventDetails(eventID),

      db.EventTypeOfEvent.findAll({
        where: { eventID: eventID }, // Ensure correct referencing
        include: [
          {
            model: db.EventType,
            attributes: ["eventType"], // Fetch event type names
          },
        ],
      }),
    ]);

    if (!eventDetails) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    // Extract event type names
    eventDetails.eventTypes = eventTypes.map(
      (et: any) => et?.EventType?.eventType
    );

    res.status(200).json(eventDetails);

    console.log("----- getEventDetails completed successfully -----");
  } catch (error: any) {
    console.error("Error fetching event details:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

controller.getUserRSVPStatus = async (req: any, res: Response) => {
  const userID = req.query.userID as string;
  const eventID = req.query.eventID as string;
  console.log(userID, eventID);

  try {
    // Find the event attendance record for the given user and event
    const eventAttendance: any = await db.EventAttendance.findOne({
      where: {
        eventID: eventID,
        userID: userID,
      },
    });

    if (!eventAttendance) {
      res.status(404).json({
        message: "RSVP status not found for this user and event.",
      });
      return;
    }

    res.status(200).json({
      userID: eventAttendance.userID,
      eventID: eventAttendance.eventID,
      status: eventAttendance.status, // Going, Interested, Not Going
    });
    return;
  } catch (error: any) {
    console.error("Error fetching RSVP status:", error);
    res.status(500).json({
      message: "Error fetching RSVP status.",
      error: error.message,
    });
    return;
  }
};

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
controller.postUserRSVPStatus = async (req: any, res: Response) => {
  try {
    const { userID, eventID, status } = req.body;

    // Update or create RSVP record
    const attendance: any = await db.EventAttendance.findOne({
      where: { userID, eventID },
    });

    if (!attendance) {
      const ret = await db.EventAttendance.create({
        userID,
        eventID,
        status: toTitleCase(status),
      });
    } else {
      const ret = await db.EventAttendance.update(
        { status: toTitleCase(status) },
        { where: { userID, eventID } }
      );
    }

    // Fetch updated event details
    const eventDetails = await fetchEventDetails(eventID);

    // Return updated event details
    res.status(200).json(eventDetails);
  } catch (error: any) {
    console.error("Error updating RSVP status:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

controller.postComment = async (req: any, res: Response) => {
  try {
    const { userID, eventID, username, comment, rating } = req.body;

    const newComment = await db.EventComment.create({
      userID,
      eventID,
      username,
      comment: comment,
      rating,
    });

    res.status(200).json(newComment);
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
    console.log(`"Internal server error", ${error.message}`);
  }
};

controller.deleteComment = async (req: any, res: Response) => {
  try {
    // Extract data from the request body
    const { userID, eventID, commentID } = req.body;

    // Check if the comment exists for the given userID, eventID, and commentID
    const comment = await db.EventComment.findOne({
      where: {
        userID: userID,
        eventID: eventID,
        commentID: commentID,
      },
    });

    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    // Delete the comment
    await comment.destroy();

    // Respond with a success message
    res.status(200).json({ message: "Comment deleted successfully" });
    return;
  } catch (error: any) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
    return;
  }
};

controller.updateComment = async (req: any, res: Response) => {
  try {
    // Extract data from the request body
    const { userID, eventID, commentID, comment } = req.body;

    // Check if the comment exists for the given userID, eventID, and commentID
    const oldComment: any = await db.EventComment.findOne({
      where: {
        userID: userID,
        eventID: eventID,
        commentID: commentID,
      },
    });

    if (!oldComment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    // Update the comment content
    oldComment.comment = comment;
    await oldComment.save();

    // Respond with a success message
    res
      .status(200)
      .json({ message: "Comment updated successfully", oldComment });
    return;
  } catch (error: any) {
    console.error("Error updating comment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
    return;
  }
};

controller.getUserEvents = async (req: any, res: Response) => {
  try {
    // Extract pagination query parameters (default limit=5 and offset=0)
    const limit: number = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 5;
    const offset: number = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : 0;
    const currentPage: number = Math.floor(offset / limit) + 1;

    // The auth middleware attaches the authenticated user to req.user.
    // Ensure we have a valid user.
    const user: any = req.user;
    if (!user) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    // 1️⃣ My Events: events created by the authenticated user (hostID === user.userID)
    const myEventsData = await db.Event.findAndCountAll({
      where: { hostID: user.userID },
      attributes: [
        "eventID",
        "eventTitle",
        "thumbnail",
        "location",
        "eventDate",
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });
    const myEvents = myEventsData.rows.map((event: any) =>
      event.get({ plain: true })
    );

    // 2️⃣ Attending Events: events where the user is marked as "Going" in EventAttendance.
    //    We join the Event table to retrieve event details.
    const attendingData = await db.EventAttendance.findAndCountAll({
      where: { userID: user.userID, status: "Going" },
      include: [
        {
          model: db.Event,
          attributes: [
            "eventID",
            "eventTitle",
            "thumbnail",
            "location",
            "eventDate",
          ],
        },
      ],
      limit,
      offset,
      order: [[db.Event, "eventDate", "DESC"]],
    });
    const attendingEvents = attendingData.rows
      .map((attendance: any) => attendance.Event)
      .filter((ev: any) => ev) // Filter out any missing event (if any)
      .map((ev: any) => ev.get({ plain: true }));

    // 3️⃣ Interested Events: events where the user is marked as "Interested"
    const interestedData = await db.EventAttendance.findAndCountAll({
      where: { userID: user.userID, status: "Interested" },
      include: [
        {
          model: db.Event,
          attributes: [
            "eventID",
            "eventTitle",
            "thumbnail",
            "location",
            "eventDate",
          ],
        },
      ],
      limit,
      offset,
      order: [[db.Event, "eventDate", "DESC"]],
    });
    const interestedEvents = interestedData.rows
      .map((attendance: any) => attendance.Event)
      .filter((ev: any) => ev)
      .map((ev: any) => ev.get({ plain: true }));

    // Build the response object with the expected structure.
    res.json({
      myEvents: {
        events: myEvents,
        totalCount: myEventsData.count,
        currentPage,
        limit,
      },
      attendingEvents: {
        events: attendingEvents,
        totalCount: attendingData.count,
        currentPage,
        limit,
      },
      interestedEvents: {
        events: interestedEvents,
        totalCount: interestedData.count,
        currentPage,
        limit,
      },
    });
  } catch (error: any) {
    console.error("Error in getUserEvents controller:", error);
    res.status(500).send(error);
  }
};

controller.getMyEvents = async (req: any, res: Response) => {
  try {
    const { limit, offset } = req.query;
    const userID = req.user.userID;
    const myEventsData = await db.Event.findAndCountAll({
      where: { hostID: userID },
      limit: limit ? parseInt(limit, 10) : 5,
      offset: offset ? parseInt(offset, 10) : 0,
      order: [["createdAt", "DESC"]],
    });
    res.json({
      events: myEventsData.rows,
      totalCount: myEventsData.count,
    });
  } catch (error) {
    console.error("Error fetching user's events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

controller.getAttendingEvents = async (req: any, res: Response) => {
  try {
    const { limit, offset } = req.query;
    const userID = req.user.userID;
    const attendingData = await db.EventAttendance.findAndCountAll({
      where: { userID: userID, status: "Going" },
      include: [
        {
          model: db.Event,
          attributes: [
            "eventID",
            "eventTitle",
            "thumbnail",
            "location",
            "eventDate",
          ],
        },
      ],
      limit: limit ? parseInt(limit, 10) : 5,
      offset: offset ? parseInt(offset, 10) : 0,
      order: [[db.Event, "eventDate", "DESC"]],
    });
    // Map to extract event details
    const events = attendingData.rows
      .map((attendance: any) => attendance.Event)
      .filter((ev: any) => ev)
      .map((ev: any) => ev.get({ plain: true }));
    res.json({
      events,
      totalCount: attendingData.count,
    });
  } catch (error) {
    console.error("Error fetching attending events:", error);
    res.status(500).json({ error: "Failed to fetch attending events" });
  }
};

controller.getInterestedEvents = async (req: any, res: Response) => {
  try {
    const { limit, offset } = req.query;
    const userID = req.user.userID;
    const interestedData = await db.EventAttendance.findAndCountAll({
      where: { userID: userID, status: "Interested" },
      include: [
        {
          model: db.Event,
          attributes: [
            "eventID",
            "eventTitle",
            "thumbnail",
            "location",
            "eventDate",
          ],
        },
      ],
      limit: limit ? parseInt(limit, 10) : 5,
      offset: offset ? parseInt(offset, 10) : 0,
      order: [[db.Event, "eventDate", "DESC"]],
    });
    // Map to extract event details
    const events = interestedData.rows
      .map((attendance: any) => attendance.Event)
      .filter((ev: any) => ev)
      .map((ev: any) => ev.get({ plain: true }));
    res.json({
      events,
      totalCount: interestedData.count,
    });
  } catch (error) {
    console.error("Error fetching interested events:", error);
    res.status(500).json({ error: "Failed to fetch interested events" });
  }
};

controller.getEditEventDetails = async (req: any, res: Response) => {
  try {
    console.log("----- getEditEventDetails invoked -----");

    const { eventID } = req.params;

    if (!eventID) {
      console.error("Event ID is missing.");
      res.status(400).json({ error: "Event ID is required" });
      return;
    }

    // Fetch event details first
    const eventDetails: any = await fetchEventDetails(eventID);
    if (!eventDetails) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    // Return the final event details
    res.status(200).json(eventDetails);

    console.log("----- getEditEventDetails completed successfully -----");
  } catch (error: any) {
    console.error("Error fetching event details:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

controller.updateEventController = async (req: any, res: Response) => {
  try {
    // Retrieve eventID either from URL params or the form field
    const eventID = req.params.eventID || req.body.eventID;
    const {
      eventTitle,
      description,
      location,
      eventDate,
      eventTypes,
      existingImages,
      thumbnailIndex, // new field
    } = req.body;

    // Parse the JSON strings for eventTypes and existingImages
    const parsedEventTypes: string[] = JSON.parse(eventTypes);
    const parsedExistingImages: string[] = JSON.parse(existingImages);

    // Retrieve new images uploaded via multer (if any)
    const newFiles = (req.files as Express.Multer.File[]) || [];
    const newImageUrls = newFiles.map((file) => {
      // Construct the URL for the new image; adjust if your static path is different.
      return `${req.protocol}://${req.get("host")}/uploads/events/${
        file.filename
      }`;
    });

    // Combine existing images with the new image URLs
    const combinedImages = [...parsedExistingImages, ...newImageUrls];

    // Use the provided thumbnailIndex to choose the thumbnail
    const idx = parseInt(thumbnailIndex, 10) || 0;
    const thumbnail = combinedImages.length > idx ? combinedImages[idx] : "";

    // Update the Event record
    const event = await db.Event.findOne({ where: { eventID } });
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    await event.update({
      eventTitle,
      description,
      location,
      eventDate,
      thumbnail,
    });

    // Update EventImage records:
    // Remove all existing images for this event, then bulk create new entries.
    await db.EventImage.destroy({ where: { eventID } });
    const imageEntries = combinedImages.map((imgUrl: string) => ({
      eventID,
      image: imgUrl,
    }));
    await db.EventImage.bulkCreate(imageEntries);

    // Update event types:
    // Remove old associations and create new ones.
    await db.EventTypeOfEvent.destroy({ where: { eventID } });
    for (const type of parsedEventTypes) {
      let eventTypeRecord = await db.EventType.findOne({
        where: { eventType: type },
      });
      if (!eventTypeRecord) {
        eventTypeRecord = await db.EventType.create({ eventType: type });
      }
      await db.EventTypeOfEvent.create({
        eventID,
        eventTypeID: eventTypeRecord.get("eventTypeID") as string,
      });
    }

    res.status(200).json({ message: "Event updated successfully" });
    return;
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};

controller.deleteEventController = async (
  req: any,
  res: Response
): Promise<void> => {
  const { eventID } = req.params;

  try {
    // Check if the event exists
    const event = await db.Event.findOne({ where: { eventID } });
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    // Delete associated event type mappings in EventTypeOfEvents
    await db.EventTypeOfEvent.destroy({
      where: { eventID },
    });

    // Optionally, delete related records (e.g., event comments, images, attendance)
    await db.EventComment.destroy({ where: { eventID } });
    await db.EventImage.destroy({ where: { eventID } });
    await db.EventAttendance.destroy({ where: { eventID } });

    // Finally, delete the event itself
    await db.Event.destroy({
      where: { eventID },
    });

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting event:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

controller.getEventTypes = async (req: Request, res: Response) => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ message: 'Invalid or missing query parameter: name' });
      return 
    }

    const eventTypes = await db.EventType.findAll({
      where: {
        eventType: {
          [Op.iLike]: `%${name}%`, // Case-insensitive search
        },
      },
      attributes: ['eventType'], // Select only necessary fields
      limit: 10, // Limit results for efficiency
    });

    res.json(eventTypes.map((v:any)=> v.eventType));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

controller.searchEvents = async (req: Request, res: Response) => {
  try {
    // Destructure query parameters (all optional except 'text')
    const { text, types, start, end } = req.query as {
      text?: string;
      types?: string;
      start?: string;
      end?: string;
    };

    // Build the main where condition.
    // If text is provided, search both eventTitle and location using ILIKE for case-insensitive matching.
    const where: any = {};
    if (text && text.trim()) {
      where[Op.or] = [
        { eventTitle: { [Op.iLike]: `%${text.trim()}%` } },
        { location: { [Op.iLike]: `%${text.trim()}%` } },
      ];
    }

    // Filter by eventDate if a start or end date is provided.
    if (start || end) {
      where.eventDate = {};
      if (start) {
        where.eventDate[Op.gte] = new Date(start);
      }
      if (end) {
        where.eventDate[Op.lte] = new Date(end);
      }
    }

    // Prepare the include array.
    // If "types" are provided (comma separated), filter events to those associated with at least one of the specified types.
    const include: any[] = [];
    if (types) {
      const typesArr = types
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t); // remove any empty strings
      include.push({
        model: db.EventType,
        through: { attributes: [] }, // do not return join attributes
        where: { eventType: { [Op.in]: typesArr } },
        required: true, // only include events that match the type criteria
      });
    } else {
      // Otherwise, include the associated event types (if you need to display them)
      include.push({
        model: db.EventType,
        through: { attributes: [] },
      });
    }

    // Execute the query with ordering and a limit for performance.
    const events = await db.Event.findAll({
      where,
      include,
      order: [["eventDate", "ASC"]],
      limit: 50, // adjust pagination as needed
    });

    res.json(events);
    return;
  } catch (error) {
    console.error("Error in searchEvents:", error);
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
};



const aaa = 0


// Assumed globals: randomData, db, BASE_URL, hashPassword, controller

type RandomData = {
  randomUsernames: string[];
  randomEmails: string[];
  Password: string;
  randomEventTitle: string[];
  randomEventDescriptions: string[];
  randomEventTypes: string[];
  randomEventLocations: string[];
  randomEventComments: string[];
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  let result = '';
  if (hours > 0) result += `${hours} hours `;
  if (minutes > 0) result += `${minutes} minutes `;
  result += `${seconds} seconds`;
  return result.trim();
};

const generateUniqueEventTitle = (baseTitle: string, batchId: number, i: number): string => {
  return `${baseTitle}-i${i}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

const checkCpuUsage = async (): Promise<number> => {
  try {
    const stats = await pidusage(process.pid);
    return stats.cpu / os.cpus().length;
  } catch (error) {
    console.error('Error checking CPU usage:', error);
    return 0;
  }
};

const createUsers = async () => {
  try {
    if (
      randomData.randomUsernames.length !== 20 ||
      randomData.randomEmails.length !== 20
    ) {
      throw new Error('You must provide exactly 20 unique usernames and 20 unique emails');
    }
    const hashedPassword = await hashPassword(randomData.Password);
    const userPromises = randomData.randomUsernames.map((username, index) =>
      db.User.create({
        username,
        email: randomData.randomEmails[index],
        password: hashedPassword,
      })
    );
    const userRecords = await Promise.all(userPromises);
    const users = userRecords.map((user: any) => user.userID);
    const usernames = userRecords.map((user: any) => user.username);
    console.log('Users created successfully.');
    return { users, usernames };
  } catch (error) {
    console.error('Error creating users:', error);
    throw error;
  }
};

const saveImageWithTimestampAsync = async (file: string, destinationFolder: string): Promise<string> => {
  const fileExtension = path.extname(file);
  const timestamp = Date.now();
  const newFileName = `${timestamp}${fileExtension}`;
  const newFilePath = path.join(destinationFolder, newFileName);
  const sourceFilePath = path.join('./sample', file);
  await fsPromises.copyFile(sourceFilePath, newFilePath);
  return newFileName;
};

const getRandomElements = (array: any[], count: number): any[] => {
  const shuffled = array.slice().sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

/**
 * Generates deferred interaction records (comments and attendances) for an event.
 * Returns two arrays: one for event comments and one for event attendances.
 */
const generateDeferredInteractionsForEvent = (
  eventID: string,
  users: string[],
  maxInteractions: number,
  usernames: string[],
  commentMin: number = 0,
  commentMax: number = 1,
  rsvpMin: number = 0,
  rsvpMax: number = 0,
) => {
  const allIndexes: number[] = Array.from({ length: users.length }, (_, i) => i);

  // Generate a random number within the given range
  const commentCount = Math.min(
    Math.floor(Math.random() * (commentMax - commentMin + 1)) + commentMin,
    users.length
  );
  const rsvpCount = Math.min(
    Math.floor(Math.random() * (rsvpMax - rsvpMin + 1)) + rsvpMin,
    users.length
  );

  // Pick unique user indexes for comments and RSVPs
  const commentUserIndexes = getRandomElements(allIndexes, commentCount);
  const rsvpUserIndexes = getRandomElements(allIndexes, rsvpCount);

  const commentRecords: any[] = [];
  const attendanceRecords: any[] = [];

  // Generate comments
  for (const userIndex of commentUserIndexes) {
    const randomComment =
      randomData.randomEventComments[
        Math.floor(Math.random() * randomData.randomEventComments.length)
      ];

    commentRecords.push({
      eventID,
      userID: users[userIndex],
      username: usernames[userIndex],
      comment: randomComment,
      rating: 5,
    });
  }

  // Generate RSVPs
  if (rsvpMax > 0) {
    const statuses = ['Going', 'Interested', 'Not Going'];

    for (const userIndex of rsvpUserIndexes) {
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      attendanceRecords.push({
        eventID,
        userID: users[userIndex],
        status: randomStatus,
      });
    }
  }

  return { commentRecords, attendanceRecords };
};


const createSampleEvents = async (
  n: number,
  users: string[],
  maxInteractions: number,
  req: any,
  usernames: string[]
) => {
  try {
    const startTime = Date.now();
    const destinationFolder = 'uploads/events/';
    const sampleImagesFolder = './sample';
    const imageFiles = fs
      .readdirSync(sampleImagesFolder)
      .filter((file: string) => /\.(jpg|jpeg|png|gif)$/i.test(file));
    const cachedEventTypes: { [key: string]: number } = {};
    for (const typeName of randomData.randomEventTypes) {
      if (!cachedEventTypes[typeName]) {
        const [eventType]: any = await db.EventType.findOrCreate({
          where: { eventType: typeName },
          defaults: { eventType: typeName },
        });
        cachedEventTypes[typeName] = eventType.eventTypeID;
      }
    }
    const eventsData: any[] = [];
    const eventsMeta: any[] = [];
    for (let i = 0; i < n; i++) {
      const randomEventTitle = randomData.randomEventTitle[
        Math.floor(Math.random() * randomData.randomEventTitle.length)
      ];
      const uniqueEventTitle = generateUniqueEventTitle(randomEventTitle, 0, i);
      const randomEventDescription = randomData.randomEventDescriptions[
        Math.floor(Math.random() * randomData.randomEventDescriptions.length)
      ];
      const randomEventLocation = randomData.randomEventLocations[
        Math.floor(Math.random() * randomData.randomEventLocations.length)
      ];
      const randomEventDate = new Date(Date.now() + Math.floor(Math.random() * 10000000000));
      const numImagesToSelect = Math.floor(Math.random() * 8) + 2;
      const selectedImageFiles = getRandomElements(imageFiles, numImagesToSelect);
      const savedImageUrls = [];
      for (const file of selectedImageFiles) {
        const savedName = await saveImageWithTimestampAsync(file, destinationFolder);
        savedImageUrls.push(`${BASE_URL}/uploads/events/${savedName}`);
      }

      const thumbnail = savedImageUrls[0] || "";
      eventsData.push({
        hostID: users[i % users.length],
        eventTitle: uniqueEventTitle,
        description: randomEventDescription,
        location: randomEventLocation,
        eventDate: randomEventDate,
        thumbnail,
      });
      eventsMeta.push({
        savedImageUrls,
        eventTypes: getRandomElements(randomData.randomEventTypes, Math.floor(Math.random()*randomData.randomEventTypes.length)),
      });
    }
    const createdEvents:any = await db.Event.bulkCreate(eventsData, { returning: true });
    const eventImagesData: any[] = [];
    const eventTypesData: any[] = [];
    createdEvents.forEach((event: any, index: number) => {
      const meta = eventsMeta[index];
      meta.savedImageUrls.forEach((url: string) => {
        eventImagesData.push({ eventID: event.eventID, image: url });
      });
      meta.eventTypes.forEach((typeName: string) => {
        eventTypesData.push({ eventID: event.eventID, eventTypeID: cachedEventTypes[typeName] });
      });
    });
    await Promise.all([
      db.EventImage.bulkCreate(eventImagesData),
      db.EventTypeOfEvent.bulkCreate(eventTypesData),
    ]);
    const attendanceData = createdEvents.map((event: any) => ({
      eventID: event.eventID,
      userID: event.hostID,
      status: 'Going',
    }));
    await db.EventAttendance.bulkCreate(attendanceData);
    // Generate deferred interaction records in bulk.
    let allCommentRecords: any[] = [];
    let allAttendanceRecords: any[] = [];
    for (const event of createdEvents) {
      const { commentRecords, attendanceRecords } = generateDeferredInteractionsForEvent(
        event.eventID,
        users,
        maxInteractions,
        usernames
      );
      allCommentRecords.push(...commentRecords);
      allAttendanceRecords.push(...attendanceRecords);
    }
    const promises = [];

    if (allCommentRecords.length > 0) {
      promises.push(db.EventComment.bulkCreate(allCommentRecords));
    }
    
    if (allAttendanceRecords.length > 0) {
      promises.push(db.EventAttendance.bulkCreate(allAttendanceRecords, { ignoreDuplicates: true }));
    }
    
    await Promise.all(promises);
    const elapsedTime = Date.now() - startTime;
    console.log(`Created ${n} sample events sequentially in ${formatDuration(elapsedTime)}.`);
  } catch (error) {
    console.error('Error in createSampleEvents:', error);
  }
};

const createEventsDirectly = async (m: number, users: string[], usernames: string[], minCom:number=0, maxCom:number=1, minRsvp:number=0, maxRsvp:number=0, minImg:number = 1, maxImg:number = 1, minType:number = 1, maxType:number= 2 , adj:boolean = false) => {
  try {
    const imageFiles = fs
      .readdirSync('./uploads/events/')
      .filter((file: string) => /\.(jpg|jpeg|png|gif)$/i.test(file));
    const cachedEventTypes: { [key: string]: number } = {};
    for (const typeName of randomData.randomEventTypes) {
      if (!cachedEventTypes[typeName]) {
        const [eventType]: any = await db.EventType.findOrCreate({
          where: { eventType: typeName },
          defaults: { eventType: typeName },
        });
        cachedEventTypes[typeName] = eventType.eventTypeID;
      }
    }
    const BATCH_SIZE = 1000;
    const limit = pLimit(5);
    for (let batchStart = 0; batchStart < m; batchStart += BATCH_SIZE) {
      const cpuUsage = await checkCpuUsage();
      if (cpuUsage > 80) {
        console.log(`High CPU usage detected (${cpuUsage.toFixed(2)}%). Pausing for 10 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
      const batchStartTime = Date.now();
      const batchEnd = Math.min(batchStart + BATCH_SIZE, m);
      const batchId = Math.floor(batchStart / BATCH_SIZE);
      const batchPromises = [];
      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push(
          limit(async () => {
            const randomEventTitle = randomData.randomEventTitle[
              Math.floor(Math.random() * randomData.randomEventTitle.length)
            ];
            let uniqueEventTitle;

            if (adj){
              uniqueEventTitle =  ` ${getUniqueAdjective()} `+ randomEventTitle ;
            } else {
              uniqueEventTitle = generateUniqueEventTitle(randomEventTitle, batchId, i);
            }
            
            const eventDescription = randomData.randomEventDescriptions[
              Math.floor(Math.random() * randomData.randomEventDescriptions.length)
            ];
            const eventLocation = randomData.randomEventLocations[
              Math.floor(Math.random() * randomData.randomEventLocations.length)
            ];
            const eventDate = new Date(Date.now() + Math.floor(Math.random() * 10000000000));
            const hostID = users[i % users.length];
            const selectedImages = getRandomElements(imageFiles, Math.floor(Math.random() * minImg) + maxImg);
            const imageUrls = selectedImages.map((file) => `${BASE_URL}/uploads/events/${file}`);
            const thumbnail = imageUrls[0] || '';
            return {
              eventData: { hostID, eventTitle: uniqueEventTitle, description: eventDescription, location: eventLocation, eventDate, thumbnail },
              meta: { selectedImages: imageUrls, eventTypes: getRandomElements(randomData.randomEventTypes, Math.floor(Math.random()*maxType + minType)) }
            };
          })
        );
      }
      const batchResults = await Promise.all(batchPromises);
      const eventsData = batchResults.map((result) => result.eventData);
      const eventsMeta = batchResults.map((result) => result.meta);
      const createdEvents:any = await db.sequelize.transaction(async (t) => {
        return await db.Event.bulkCreate(eventsData, { transaction: t, returning: true });
      });
      const eventImagesData: any[] = [];
      const eventTypesData: any[] = [];
      createdEvents.forEach((event: any, index: number) => {
        const meta = eventsMeta[index];
        meta.selectedImages.forEach((url: string) => {
          eventImagesData.push({ eventID: event.eventID, image: url });
        });
        meta.eventTypes.forEach((typeName: string) => {
          eventTypesData.push({ eventID: event.eventID, eventTypeID: cachedEventTypes[typeName] });
        });
      });
      await Promise.all([
        db.EventImage.bulkCreate(eventImagesData),
        db.EventTypeOfEvent.bulkCreate(eventTypesData),
      ]);
      const attendanceData = createdEvents.map((event: any) => ({
        eventID: event.eventID,
        userID: event.hostID,
        status: 'Going',
      }));
      await db.EventAttendance.bulkCreate(attendanceData);
      let allCommentRecords: any[] = [];
      let allAttendanceRecords: any[] = [];
      for (const event of createdEvents) {
        const { commentRecords, attendanceRecords } = generateDeferredInteractionsForEvent(
          event.eventID,
          users,
          m,
          usernames,
          minCom,
          maxCom,
          minRsvp,
          maxRsvp
        );
        allCommentRecords.push(...commentRecords);
        allAttendanceRecords.push(...attendanceRecords);
      }
      const promises = [];

      if (allCommentRecords.length > 0) {
        promises.push(db.EventComment.bulkCreate(allCommentRecords));
      }
      
      if (allAttendanceRecords.length > 0) {
        promises.push(db.EventAttendance.bulkCreate(allAttendanceRecords, { ignoreDuplicates: true }));
      }
      
      await Promise.all(promises);
      const batchElapsedTime = Date.now() - batchStartTime;
      // console.log(`Direct events batch ${batchStart} to ${batchEnd} processed in ${formatDuration(batchElapsedTime)}.`);
    }
    // console.log(`Successfully created ${m} direct events.`);
  } catch (error) {
    console.error('Error in createEventsDirectly:', error);
  }
};

controller.insertSampleData = async (req: any, res: any) => {
  const { n, m } = req.body;
  const { users, usernames } = await createUsers();
  await createSampleEvents(n, users, m, req, usernames);
  const numBatches = m / 1000;
  let batchDurations: number[] = [];
  console.log(`Starting event creation: ${numBatches} batches of 1000 events each.`);
  const overallStart = Date.now();
  for (let i = 0; i < numBatches; i++) {
    const cpuUsage = await checkCpuUsage();
    if (cpuUsage > 80) {
      console.log(`High CPU usage detected (${cpuUsage.toFixed(2)}%). Pausing for 10 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    const batchStart = Date.now();
    console.log(`Starting batch ${i + 1}/${numBatches}...`);
    await createEventsDirectly(1000, users, usernames);
    const duration = (Date.now() - batchStart) / 1000;
    batchDurations.push(duration);
    console.log(`Batch ${i + 1} processed in ${duration.toFixed(2)} seconds.`);
    const avgDuration = batchDurations.reduce((a, b) => a + b, 0) / batchDurations.length;
    const remainingBatches = numBatches - (i + 1);
    const estimatedRemainingTime = remainingBatches * avgDuration;
    console.log(`ETA: ~${Math.ceil(estimatedRemainingTime)} seconds remaining.`);
  }
  const totalDuration = (Date.now() - overallStart) / 1000;
  console.log(`All batches completed in ${totalDuration.toFixed(2)} seconds.`);
  await createEventsDirectly(500, users, usernames, 10, 20, 10, 20, 3, 8, 4, 9, true);
  console.log('Added 500 High volume data');
  res.json({ message: 'Created N Events Successfully' });
};

controller.createSampleEventController = async (req: any, res: any): Promise<void> => {
  try {
    console.log('----- createEventController invoked -----');
    const {
      eventTitle,
      description,
      location,
      eventDate,
      thumbnailIndex,
      eventTypes,
      userID,
    } = req.body;
    const files: any = req.files;
    const errors: string[] = [];
    if (!eventTitle) errors.push('Event title is required.');
    if (!description) errors.push('Description is required.');
    if (!location) errors.push('Location is required.');
    if (!eventDate) errors.push('Event date is required.');
    let eventTypesArr: any;
    try {
      eventTypesArr = typeof eventTypes === 'string' ? JSON.parse(eventTypes) : eventTypes;
    } catch (e) {
      errors.push('Invalid format for event types.');
    }
    if (!eventTypesArr || !Array.isArray(eventTypesArr) || eventTypesArr.length === 0) {
      errors.push('At least one event type is required.');
    }
    if (!files || files.length === 0) {
      errors.push('At least one event image is required.');
    }
    if (
      thumbnailIndex === undefined ||
      isNaN(thumbnailIndex) ||
      parseInt(thumbnailIndex, 10) >= files.length
    ) {
      errors.push('Invalid or missing thumbnail index.');
    }
    if (errors.length > 0) {
      console.error('Validation errors:', errors);
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    const uniqueEventTitle = `${eventTitle}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const imageUrls = files.map((file: any) => `${BASE_URL}/uploads/events/${file.filename}`);
    const newEvent: any = await db.Event.create({
      hostID: userID,
      eventTitle: uniqueEventTitle,
      description,
      location,
      eventDate,
      thumbnail: imageUrls[parseInt(thumbnailIndex, 10)],
    });
    const eventID = newEvent.eventID;
    await db.EventImage.bulkCreate(imageUrls.map((url: string) => ({ eventID, image: url })));
    const cachedEventTypes: { [key: string]: number } = {};
    for (const typeName of eventTypesArr) {
      if (!cachedEventTypes[typeName]) {
        const [eventType]: any = await db.EventType.findOrCreate({
          where: { eventType: typeName },
          defaults: { eventType: typeName },
        });
        cachedEventTypes[typeName] = eventType.eventTypeID;
      }
    }
    const eventTypesData = eventTypesArr.map((typeName: string) => ({
      eventID,
      eventTypeID: cachedEventTypes[typeName],
    }));
    await db.EventTypeOfEvent.bulkCreate(eventTypesData);
    await db.EventAttendance.create({
      eventID,
      userID: userID,
      status: 'Going',
    });
    res.status(201).json({ event: newEvent, message: 'Event created successfully!' });
    console.log('----- createEventController completed successfully -----');
  } catch (error: any) {
    console.error('Error in createEventController:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};


export default controller;