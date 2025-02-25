const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator");
const {
  User,
  Rol,
  Movie,
  Serie,
  Cart,
  Price,
} = require("../database/models/index.js"); //Requiere los modelos para poder usar directamente la variable

let controller = {
  login: (req, res) => {
    res.render("./users/login", {
      title: "Login",
      session: req.session,
    });
  },
  register: (req, res) => {
    res.render("./users/register", {
      title: "Register",
      session: req.session,
    });
  },
  loadLogin: async (req, res) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      try {
        let user = await User.findOne({
          where: {
            email: req.body.email.toLowerCase(),
          },
        });
  
        req.session.user = {
          id: user.id,
          name: user.first_name,
          lastName: user.last_name,
          userName: user.user_name,
          email: user.email,
          avatar: user.avatar,
          rol: user.RolId,
        };
  
        if (req.body.recordarme) {
          const TIME_IN_MILISECONDS = 6000000;
          res.cookie("userSlowMotion", req.session.user, {
            expires: new Date(Date.now() + TIME_IN_MILISECONDS),
            httpOnly: true,
            secure: true,
          });
        }
  
        res.locals.user = req.session.user;
  
        req.session.cart = [];
  
        let cart = await Cart.findAll({
          where: {
            UserId: user.id,
          },
          include: [
            {
              model: Movie,
              include: {
                model: Price,
              },
            },
            {
              model: Serie,
              include: {
                model: Price,
              },
            },
            {
              model: User,
            },
          ],
        });
        if (cart[0]) {
          cart[0].Movies.forEach((element) => {
            req.session.cart.push({
              id: element.id,
              title: element.title,
              duration: element.duration,
              image: element.image,
              description: element.description,
              Price: element.Price,
              type: "buy",
            });
          });
          cart[0].Series.forEach((element) => {
            req.session.cart.push({
              id: element.id,
              title: element.title,
              seasons: element.seasons,
              image: element.image,
              description: element.description,
              Price: element.Price,
              type: "buy",
            });
          });
          cart[1].Movies.forEach((element) => {
            req.session.cart.push({
              id: element.id,
              title: element.title,
              duration: element.duration,
              image: element.image,
              description: element.description,
              Price: element.Price,
              type: "rental",
            });
          });
          cart[1].Series.forEach((element) => {
            req.session.cart.push({
              id: element.id,
              title: element.title,
              seasons: element.seasons,
              image: element.image,
              description: element.description,
              Price: element.Price,
              type: "rental",
            });
          });
        } else {
          await user.createCart({
            type: "buy",
          });
          await user.createCart({
            type: "rental",
          });
        }
        return res.redirect("/");
        
      } catch (error) {
        console.log(error)
      }
    } else {
      return res.render("./users/login", {
        title: "Login",
        errors: errors.mapped(),
        session: req.session,
      });
    }
  },
  loadRegister: async (req, res) => {
    const errors = validationResult(req);

    /* Hecho con try catch, ver como se guardan */
    if (errors.isEmpty()) {
      const { name, lastName, userName, email, pass1 } = req.body;
      try {
        let userCreate = await User.create({
          first_name: name,
          last_name: lastName,
          user_name: userName,
          email: email.toLowerCase(),
          password: bcrypt.hashSync(pass1),
          avatar: req.file ? req.file.filename : "default-avatar.jpg",
        });
        let rolCreate = await Rol.findOne({ where: { type: 0 } });
        await rolCreate.addUser(userCreate);
        res.redirect("/users/login");
      } catch (error) {
        res.send("user no creado");
      }
    } else {
      let old = req.body;
      deleteImageUser(req);
      res.render("./users/register", {
        title: "Register",
        errors: errors.mapped(),
        old,
        session: req.session,
      });
    }
  },
  profile: async (req, res) => {
    let userSession = req.session.user;
    let userFind = await User.findByPk(userSession.id);

    /* conversión del formato de fecha para pasarle al value */
    const finalDate = new Date(userFind.date_of_birth)
      .toISOString()
      .slice(0, 10);

    res.render("users/userProfile", {
      title: "User Profile",
      session: req.session,
      user: userFind,
      finalDate,
    });
  },
  optionalProfile: async (req, res) => {
    const errors = validationResult(req);
    let userSession = req.session.user;
    let userFind = await User.findByPk(userSession.id);

    if (errors.isEmpty()) {
      const { phone, dateOfBirth, genre, address, country, province, city } =
        req.body;
      try {
        await User.update(
          {
            phone,
            date_of_birth: dateOfBirth,
            genre,
            address,
            country,
            province,
            city,
          },
          {
            where: { id: userSession.id },
          }
        );

        res.redirect("/users/profile");
      } catch (error) {
        res.send(error);
      }
    } else {
      res.render("users/userProfile", {
        title: "User Profile",
        errors: errors.mapped(),
        session: req.session,
        user: userFind,
      });
    }
  },
  profileAuth: async (req, res) => {
    let userSession = req.session.user;
    let userFind = await User.findByPk(userSession.id);

    res.render("users/userProfileAuth", {
      title: "User Profile Auth",
      session: req.session,
      user: userFind,
    });
  },
  optionalProfileAuth: async (req, res) => {
    const errors = validationResult(req);
    let userSession = req.session.user;
    let userFind = await User.findByPk(userSession.id);

    if (errors.isEmpty()) {
      const {
        first_name,
        last_name,
        user_name,
        email,
        actualPassword,
        newPassword,
      } = req.body;
      try {
        await User.update(
          {
            first_name,
            last_name,
            user_name,
            email: email.toLowerCase(),
            password:
              newPassword == ""
                ? bcrypt.hashSync(actualPassword)
                : bcrypt.hashSync(newPassword),
          },
          {
            where: { id: userSession.id },
          }
        );

        req.session.destroy();
        if (req.cookies.userSlowMotion) {
          res.cookie("userSlowMotion", "", { maxAge: -1 });
        }
        res.redirect("/users/login");
      } catch (error) {
        res.send(error);
      }
    } else {
      res.render("users/userProfileAuth", {
        title: "User Profile Auth",
        errors: errors.mapped(),
        session: req.session,
        user: userFind,
      });
    }
  },
  changeAvatar: async (req, res) => {
    const errors = validationResult(req);
    let userSession = req.session.user;
    let userFind = await User.findByPk(userSession.id);
    const finalDate = new Date(userFind.date_of_birth)
      .toISOString()
      .slice(0, 10);

    if (errors.isEmpty()) {
      if (
        fs.existsSync(
          path.join(__dirname, "../../public/img/users-images/"),
          userFind.avatar
        )
      ) {
        if (userFind.avatar !== "default-avatar.jpg") {
          fs.unlinkSync(
            `${path.join(__dirname, "../../public/img/users-images/")}${
              userFind.avatar
            }`
          );
        }

        try {
          await User.update(
            {
              avatar: req.file.filename,
            },
            {
              where: { id: userFind.id },
            }
          );

          req.session.destroy();
          if (req.cookies.userSlowMotion) {
            res.cookie("userSlowMotion", "", { maxAge: -1 });
          }
          res.redirect("/users/login");
        } catch (error) {
          res.send(error);
        }
      }
    } else {
      res.render("users/userProfile", {
        title: "User Profile",
        errors: errors.mapped(),
        session: req.session,
        user: userFind,
        finalDate,
      });
    }
  },
  logout: (req, res) => {
    req.session.destroy();
    if (req.cookies.userSlowMotion) {
      res.cookie("userSlowMotion", "", { maxAge: -1 });
    }
    res.redirect("/");
  },
  favorites: async (req, res) => {
    try {
      let user = await User.findOne({
        where: { id: req.session.user.id },
        include: [
          {
            model: Movie,
          },
          {
            model: Serie,
          },
        ],
      });
      res.render("users/favorites", {
        title: "favorites",
        movies: user.Movies,
        series: user.Series,
        session: req.session,
      });
    } catch (error) {
      console.log(error.message);
    }
  },
  addFavorite: async (req, res) => {
    if (req.query.product === "Movie") {
      try {
        let movieSearch = await Movie.findByPk(req.query.id);
        let userSearch = await User.findByPk(req.session.user.id);
        await userSearch.addMovie(movieSearch);
        res.redirect("/users/favorites");
      } catch (error) {
        console.log(error.message);
      }
    } else {
      try {
        let serieSearch = await Serie.findByPk(req.query.id);
        let userSearch = await User.findByPk(req.session.user.id);
        await userSearch.addSerie(serieSearch);
        res.redirect("/users/favorites");
      } catch (error) {
        console.log(error.message);
      }
    }
  },
  destroyFavorite: async (req, res) => {
    let userSearch = await User.findByPk(req.session.user.id);
    if (req.query.product === "Movie") {
      try {
        let movieDelete = await Movie.findByPk(req.query.id);
        await userSearch.removeMovies(movieDelete);
        res.redirect("/users/favorites");
      } catch (error) {
        res.send(error.message);
      }
    } else {
      try {
        let serieDelete = await Serie.findByPk(req.query.id);
        await userSearch.removeSeries(serieDelete);
        res.redirect("/users/favorites");
      } catch (error) {
        res.send(error.message);
      }
    }
  },
};

const deleteImageUser = (req) => {
  if (req.file) {
    fs.unlinkSync(`./public/img/users-images/${req.file.filename}`);
  }
  return true;
};

module.exports = controller;
