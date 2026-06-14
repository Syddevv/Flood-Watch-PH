import { v2 as cloudinary } from "cloudinary";

function getRequiredCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  return {
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  };
}

export async function uploadReportImageToCloudinary(
  fileBuffer: Buffer,
  fileName: string,
) {
  cloudinary.config(getRequiredCloudinaryConfig());

  return new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "floodwatchph/reports",
        public_id: `${Date.now()}-${fileName.replace(/\.[^.]+$/, "")}`,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url) {
          reject(new Error("Cloudinary did not return a secure image URL."));
          return;
        }

        resolve(result.secure_url);
      },
    );

    uploadStream.end(fileBuffer);
  });
}
