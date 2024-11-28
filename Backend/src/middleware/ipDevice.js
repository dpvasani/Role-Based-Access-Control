// Install required packages: npm install request-ip express-useragent geoip-lite

import requestIp from "request-ip";
import userAgent from "express-useragent";
import geoip from "geoip-lite";

export const trackUserActivity = (req, res, next) => {
  try {
    // Retrieve IP address of the client
    const ip = requestIp.getClientIp(req) || "Unknown";

    // Parse user-agent to get device details
    const userAgentDetails = userAgent.parse(req.headers["user-agent"]);

    // Get location data based on IP
    const location = geoip.lookup(ip);

    // Attach tracking data to request object
    req.trackingData = {
      ip,
      device: {
        source: userAgentDetails.source,
        browser: userAgentDetails.browser,
        os: userAgentDetails.os,
        platform: userAgentDetails.platform,
        isMobile: userAgentDetails.isMobile,
        isDesktop: userAgentDetails.isDesktop,
      },
      location: location || { city: "Unknown", country: "Unknown" },
    };

      // Example: Block access from a specific IP
      if (req.trackingData.ip === "blocked-ip") {
        return res.status(403).json({ message: "Access denied from this IP" });
      }

    next();
  } catch (error) {
    console.error("Error in tracking middleware:", error.message);
    req.trackingData = {
      ip: "Unknown",
      device: {},
      location: { city: "Unknown", country: "Unknown" },
    };
    next();
  }
};
