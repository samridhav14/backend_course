import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // take input from frontend
  // do validations
  // check if user already exists
  //  check images and avatar
  // upload to cloudinary
  // create user object create entry in db
  // remove password and refresh token from response
  // check for user creation
  // return response
  const { fullName, email, userName, password } = req.body;
  // some will  checks if there is any field which is empty
  if (
    [fullName, email, userName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new ApiError(400, "Incorrect Email");
  }
  const existedUser = User.findOne({
    // to check multipe values
    $or: [{ userName }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "Username or Email already exists!!");
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
  console.log(req.files);
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar not found");
  }
  // uploading on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPathLocalPath);
  if (!avatar) {
    throw new ApiError("Avatar file required");
  }
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage.url || "",
    email,
    password,
    userName: userName.toLoweCase(),
  });
  console.log(user);
  // removing password and token
  const createdUser = User.findById(user._id).select("-password -refreshToken");
  if (createdUser) {
    throw new ApiError("Something went wrong while registering");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Created Successfully"));
});

export { registerUser };
