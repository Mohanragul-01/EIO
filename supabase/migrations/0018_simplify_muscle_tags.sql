-- ============================================================================
-- Fold the muscle tags back down to a usable number
-- ============================================================================
-- 0014 introduced twenty-two muscles: upper/mid/lower chest, lats, traps,
-- rhomboids, three separate delts, quads, hamstrings, glutes, calves,
-- adductors, obliques, lower abs. That is the vocabulary of a coaching
-- textbook, not of someone standing in a gym picking an exercise, and it made
-- the library harder to use rather than easier - a list you have to think about
-- before tagging is a list you will tag wrong.
--
-- What is left splits only where the split changes what you actually do:
--
--   Chest, Back, Shoulders, Legs   one tag each
--   Arms                           Biceps, Triceps, Forearms
--   Core                           Abs, Lower back
--   Other                          Cardio, Full body
--
-- Eleven tags instead of twenty-two.
--
-- NOT STRICTLY REQUIRED. Both clients fold the old names into the new ones when
-- they READ an exercise, so the library looks right without this. Running it
-- makes the stored rows agree with what you see, which matters the moment you
-- edit one - otherwise saving an exercise you never touched the tag on would
-- quietly rewrite it anyway.
--
-- Anything not listed here is left alone, including a tag you typed yourself.
-- ============================================================================

update public.exercises
set muscle_group = case muscle_group
    when 'Upper chest' then 'Chest'
    when 'Mid chest'   then 'Chest'
    when 'Lower chest' then 'Chest'

    when 'Lats'      then 'Back'
    when 'Traps'     then 'Back'
    when 'Rhomboids' then 'Back'

    when 'Front delts' then 'Shoulders'
    when 'Side delts'  then 'Shoulders'
    when 'Rear delts'  then 'Shoulders'
    -- Neck has nowhere better to go and is rare enough not to earn a tag.
    when 'Neck'        then 'Shoulders'

    when 'Quads'      then 'Legs'
    when 'Hamstrings' then 'Legs'
    when 'Glutes'     then 'Legs'
    when 'Calves'     then 'Legs'
    when 'Adductors'  then 'Legs'

    when 'Obliques'  then 'Abs'
    when 'Lower abs' then 'Abs'

    else muscle_group
  end
where muscle_group in (
  'Upper chest', 'Mid chest', 'Lower chest',
  'Lats', 'Traps', 'Rhomboids',
  'Front delts', 'Side delts', 'Rear delts', 'Neck',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors',
  'Obliques', 'Lower abs'
);

-- The `where` above is what makes this safe to run twice: once a row says
-- 'Chest' it is no longer in the list, so a second run matches nothing and a
-- tag you have since corrected by hand cannot be dragged back.
