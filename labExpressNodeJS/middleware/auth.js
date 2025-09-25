const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login');
};

const isAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.userRole === 'admin') {
    return next();
  }
  return res.redirect('/login');
};

const isUser = (req, res, next) => {
  if (req.session && req.session.userId && req.session.userRole === 'user') {
    return next();
  }
  return res.redirect('/login');
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isUser
};