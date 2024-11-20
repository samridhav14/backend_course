import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access token"
    );
  }
};
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
  const existedUser = await User.findOne({
    // to check multipe values
    $or: [{ userName }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "Username or Email already exists!!");
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath = "";
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  // console.log(req.files);
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar not found");
  }
  // uploading on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError("Avatar file required");
  }
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage == null ? "" : coverImage.url,
    email,
    password,
    userName: userName.toLowerCase(),
  });
  // console.log(user);
  // removing password and token
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // console.log(createdUser);
  if (!createdUser) {
    throw new ApiError("Something went wrong while registering");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Created Successfully"));
});
const loginUser = asyncHandler(async (req, res) => {
  // req body data
  // userName email
  // find user
  // password check
  // access and refresh token need to be generated
  // send secure cookies with response
  const { email, userName, password } = req.body;
  if (!email && !userName) {
    throw new ApiError(400, "userName or email is required");
  }
  const user = await User.findOne({
    $or: [{ userName }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  // we cant use User here because this is the instance of mongo db where as we need to check for the present user
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Password Incorrect");
  }
  const { accessToken, refreshToken } = await generateTokens(user._id);
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // settings for cookies
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          // if user want to set local cookies in case it is not saving in browser
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged in Successfully!!"
      )
    );
});
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out successfully!!"));
});
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken._id);
    if (!user) {
      throw new ApiError(401, "Invalid RefreshToken");
    }
    if (incomingRefreshToken != user?.refreshToken) {
      throw new ApiError(401, "Refresh Token expired or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newRefreshToken } = await generateTokens(user._id);
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed!!"
        )
      );
  } catch (error) {
    throw new ApiError(
      401,
      "Something went wrong while generating access token"
    );
  }
});
const changeCurrentPassword = asyncHandler(
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.body?._id);
    const isPasswordCorrect = user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
      throw new ApiError(400, "Invalid Password");
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password Changed Successfully!!"));
  })
);
const getUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User Fetched successfully!"));
});
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, userName } = req.body;
  if (!fullName || !userName) {
    throw new ApiError(400, "All fields are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        userName,
      },
    },
    {
      // to save updated data
      new: true,
    }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details Updated"));
});

const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar || !avatar.url) {
    throw new ApiError(400, "Error while uploading Avatar");
  }
  const user = await User.findOneAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Details Updated"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "CoverImage file is missing");
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage || !coverImage.url) {
    throw new ApiError(400, "Error while uploading CoverImage");
  }
  const user = await User.findOneAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "coverImage Details Updated"));
});
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getUser,
  updateAccountDetails,
  updateAvatar,
  updateUserCoverImage,
};
