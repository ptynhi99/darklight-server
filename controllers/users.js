const asyncHandler = require('express-async-handler')
const User = require("../models/User")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")


const generalAccessToken = (data) => {
  const access_token  = jwt.sign({data}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '60m'})
  return access_token
}

const generalRefreshToken = (data) => {
  const access_token  = jwt.sign({data}, process.env.REFRESH_TOKEN_SECRET, {expiresIn: '10d'})
  return access_token
}

// Register User
const registerUser = asyncHandler( async (req, res) => {
    const { name, email, password, avatar } = req.body

    // Validation
    if (!name || !email || !password) {
        res.status(200).json({err: "Please fill in all required fields"})
        throw new Error("Please fill in all required fields")
    }
    if (password.length < 6) {
        res.status(200).json({err: "Password must be up to 6 characters"})
        throw new Error("Password must be up to 6 characters")
    }

    // Check if user email already exists
    const userExists = await User.findOne({ email })

    if (userExists) {
        res.status(200).json({err: "Email has already been registered"})
        throw new Error("Email has already been registered")
    }
    
    //create new user
    const user = await User.create({
        name,
        email,
        password,
        avatar,
        type: 'emailWithPassword'
    })

    //   Generate Token
    const accessToken = generalAccessToken(user._id)
    const newRefreshToken = generalRefreshToken(user._id)
    
    if (user) {
        const { name, avatar } = user
        user.refreshToken = [newRefreshToken]
        await user.save()
        res.cookie('jwt', newRefreshToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 24 * 60 * 60 * 1000*10 })

        res.status(201).json({
            name,
            avatar,
            accessToken,
            name,
            email,
        })
    } 
    else {
        res.status(200).json({err: "Invalid user data"})
        throw new Error("Invalid user data")
    }
})

// Login User
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body
    const cookies = req.cookies
    // Validate Request
    if (!email || !password) {
      res.status(400)
      throw new Error("Please add email and password")
    }
  
    // Check if user exists
    const user = await User.findOne({ email })
  
    if (!user) {
      res.status(200).json({err:"User not found, please signup"})
      throw new Error("User not found, please signup")
    }
    
    // User exists, check if password is correct
    const passwordIsCorrect = await bcrypt.compare(password, user.password)

  
    if (user && passwordIsCorrect) {
      const { _id, name, email, avatar } = user
      
      //   Generate Token
      const accessToken = generalAccessToken(user._id)
      const newRefreshToken = generalRefreshToken(user._id)
      
      // Changed to let keyword
      let newRefreshTokenArray =
      !cookies?.jwt
          ? user.refreshToken
          : user.refreshToken.filter(rt => rt !== cookies.jwt)

      if (cookies?.jwt) {

        const refreshToken = cookies.jwt
        const foundToken = await User.findOne({ refreshToken }).exec()

        // Detected refresh token reuse!
        if (!foundToken) {
            newRefreshTokenArray = []
        }

        res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true })
      }

      user.refreshToken = [...newRefreshTokenArray, newRefreshToken]
      await user.save()

        // Creates Secure Cookie with refresh token
      res.cookie('jwt', newRefreshToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 24 * 60 * 60 * 1000 *10 })
      
      res.status(200).json({
        _id,
        name,
        email,
        avatar,
        accessToken,
      })
    } else {
      res.status(400).json({err:"Invalid email or password"})
      throw new Error("Invalid email or password")
    }
})

// Login With Google

const loginUserWithGoogle = asyncHandler(async (req, res) => {
  const { email, name, avatar } = req.body
  const cookies = req.cookies

  // Validate Request
  if (!email || !name || !avatar) {
    res.status(400)
    throw new Error("Error")
  }

  // Check if user exists
  let user = await User.findOne({ email })

  if(!user){
    user = await User.create({
        name,
        email,
        password: '',
        avatar,
        type: 'google'
    })
  }
  else {
    if(user.type === 'emailWithPassword'){
      res.status(400)
      throw new Error("Email was exits")
    }
  }

  if (user) {
    const { _id, name, email, avatar } = user

      //   Generate Token
  const accessToken = generalAccessToken(user._id)
  const newRefreshToken = generalRefreshToken(user._id)

  // Changed to let keyword
  let newRefreshTokenArray =
  !cookies?.jwt
      ? user.refreshToken
      : user.refreshToken.filter(rt => rt !== cookies.jwt)

  if (cookies?.jwt) {

    const refreshToken = cookies.jwt
    const foundToken = await User.findOne({ refreshToken }).exec()

    // Detected refresh token reuse!
    if (!foundToken) {
        newRefreshTokenArray = []
    }

    res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true })
  }

  user.refreshToken = [...newRefreshTokenArray, newRefreshToken]
  await user.save()

    // Creates Secure Cookie with refresh token
  res.cookie('jwt', newRefreshToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 24 * 60 * 60 * 1000*10 })

  res.status(200).json({
    _id,
    name,
    email,
    avatar,
    accessToken,
  })


  } else {
    res.status(400)
    throw new Error("Error")
  }
})

  
// Logout User
const logout = asyncHandler(async (req, res) => {
  const cookies = req.cookies
  
  const refreshToken = cookies.jwt
  const user = await User.findOne({ refreshToken }).exec()
  const newRefreshTokenArray = user.refreshToken.filter(rt => rt !== refreshToken)
  user.refreshToken = [...newRefreshTokenArray]
  await user.save()

  res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true })
  return res.status(200).json({ message: "Successfully Logged Out" })
})

// Get User Data
const getUser = asyncHandler(async (req, res) => {
    const {id} = req.query
    const user = await User.findById(id)
  
    if (user) {
      const { _id, name, email, avatar } = user
      res.status(200).json({_id, name, email, avatar })
    } else {
      res.status(400)
      throw new Error("User Not Found")
    }
})


const handleRefreshToken = async (req, res) => {
    const cookies = req.cookies
    
    if (!cookies?.jwt) return res.status(401)
    const refreshToken = cookies.jwt
    
    res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true })

    const user = await User.findOne({ refreshToken }).exec()

    // Detected refresh token reuse!
    if (!user) {
        jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
            async (err, decoded) => {
                if (err) return res.status(403) //Forbidden
                const hackedUser = await User.findById(decoded.data).exec()
                
                hackedUser.refreshToken = []
                await hackedUser.save()
            }
        )
        return res.status(403) //Forbidden
    }

    const newRefreshTokenArray = user.refreshToken.filter(rt => rt !== refreshToken)
    
    // evaluate jwt 
    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, decoded) => {

            if (err) {
                user.refreshToken = [...newRefreshTokenArray]
                await user.save()
            }
            
            if (err || user._id.toString() !== decoded.data) return res.status(403)

            // Refresh token was still valid
            const accessToken = generalAccessToken(user._id)
            const newRefreshToken = generalRefreshToken(user._id)
            
            // Saving refreshToken with current user
            user.refreshToken = [...newRefreshTokenArray, newRefreshToken]
            await user.save()
            res.cookie('jwt', newRefreshToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 24 * 60 * 60 * 1000*10 })
            res.json({ accessToken, refreshToken })
            
        }
    )
}

const checkLogin = asyncHandler(async (req, res) => {
  const cookies = req.cookies
  
  if (!cookies?.jwt) 
    {res.status(200).json({ login: false })
    return}
  const refreshToken = cookies.jwt
  const foundUser = await User.findOne({ refreshToken : refreshToken }).exec()
    
  if(!foundUser)
    {res.status(200).json({ login: false })
    return}
    
  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, decoded) => {
      const { _id, email,name, avatar } = foundUser
      const accessToken = generalAccessToken(foundUser._id)
      
      if (foundUser._id.toString() === decoded.data) 
        res.status(200).json({_id, email, name, avatar, accessToken })
    }
  )
})

  
module.exports = {
    registerUser,
    loginUser,
    loginUserWithGoogle,
    logout,
    getUser,
    handleRefreshToken,
    checkLogin
}