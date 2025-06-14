export default function getGreeting() {
  const hour = new Date().getHours();

  if (hour >= 0 && hour < 5) {
    return {
      greeting: "Midnight Hustle 🔥",
      message: "Still grinding? Don't forget to rest soon 😴"
    };
  } else if (hour < 12) {
    return {
      greeting: "Good Morning ☀️",
      message: "Hope you have a productive day ahead 🚀"
    };
  } else if (hour < 17) {
    return {
      greeting: "Good Afternoon 🌤️",
      message: "Hope your day is going well 😊"
    };
  } else if (hour < 22) {
    return {
      greeting: "Good Evening 🌙",
      message: "Hope you had a great day ✨"
    };
  } else {
    return {
      greeting: "Late Night 🌃",
      message: "Almost done? Wind down when you can 💤"
    };
  }
}
