export const loadIcons = () => {
  const context = (require as NodeRequire).context("../icon", true, /.*\.svg/);
  return context.keys().map(path => {
    return {
      path: path,
      img: context(path)
    };
  });
};
