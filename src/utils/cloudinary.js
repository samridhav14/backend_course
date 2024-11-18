import {v2 as cloudinary} from 'cloudinary';
import { response } from 'express';
import fs from "fs";

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret:process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary=async(localFilePath)=>{
    try{
        if(!localFilePath) return null;
        // upload
        const uploadResult = await cloudinary.uploader
        .upload(
            localFilePath,{
                resource_type:"auto"
            }
        )
       // console.log("file uploaded",uploadResult.url);
       fs.unlinkSync(localFilePath)
        return uploadResult;
    }catch(error){
         fs.unlinkSync(localFilePath) // remove local file which is temp file as uploading failed
    }
}

export {uploadOnCloudinary}