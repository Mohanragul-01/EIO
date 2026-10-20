/**
 * Runs the whole test suite in a time zone that has daylight saving.
 *
 * The app's dates are calendar days built from (year, month, day), never by
 * adding 24 hours, because on the night the clocks change 24 hours is not a
 * day. India has no daylight saving, so in the zone this machine runs in,
 * every such bug would pass unnoticed. New York springs forward on the second
 * Sunday of March and falls back in November, so a test that steps through
 * those days here catches them.
 *
 * Set in globalSetup, before the test workers start, because Jest gives each
 * test file its own copy of process.env: setting TZ inside a test changes
 * nothing.
 */
module.exports = async () => {
  process.env.TZ = 'America/New_York';
};
