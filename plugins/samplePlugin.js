module.exports = {
  name: "Sample Plugin",
  onLoad: () => {
    console.log("Sample Plugin loaded.");
  },
  onUnload: () => {
    console.log("Sample Plugin unloaded.");
  }
};