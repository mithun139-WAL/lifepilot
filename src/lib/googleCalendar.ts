import { google } from "googleapis";

export async function createGoogleCalendarEvent(params: {
  accessToken: string;
  refreshToken: string;
  summary: string;
  description: string;
  start: Date | string | number;
  end: Date | string | number;
}) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
  });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const event = {
    summary: params.summary,
    description: params.description,
    start: {
      dateTime: new Date(params.start).toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: new Date(params.end).toISOString(),
      timeZone: "UTC",
    },
  };
  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });
    return response.data;
  } catch (error) {
    console.error("Error creating Google Calendar event:", error);
    throw error;
  }
}

export async function deleteGoogleCalendarEvent(params: {
  accessToken: string;
  refreshToken: string;
  eventId: string;
}) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
  });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId: params.eventId,
    });
  } catch (error) {
    console.error("Error deleting Google Calendar event:", error);
    throw error;
  }
}
