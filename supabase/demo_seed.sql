-- ============================================================
-- AFTERHOURS — DEMO SEED
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- All timestamps are UTC (IST = UTC+5:30).
-- Event format matches the create-event flow exactly:
--   date     → "D Mon · HH:MM"  (en-GB, numeric day, no leading zero)
--   price    → "Free" or "₹{amount}"
--   tag      → category with first letter capitalised
--   starts_at → ISO UTC timestamp
-- ============================================================

DO $$
DECLARE
  c uuid;
BEGIN

  -- Resolve the admin user
  SELECT id INTO c FROM auth.users WHERE email = 'afterhours.admins@gmail.com' LIMIT 1;
  IF c IS NULL THEN
    RAISE EXCEPTION 'Admin user not found — check the email address at the top of this script';
  END IF;

  -- ── Optional: wipe existing events by this user before re-seeding ──────────
  -- Uncomment if you want a clean slate:
  -- DELETE FROM public.rsvps  WHERE event_id IN (SELECT id FROM public.events WHERE creator_id = c);
  -- DELETE FROM public.events WHERE creator_id = c;
  -- ───────────────────────────────────────────────────────────────────────────

  INSERT INTO public.events (
    creator_id, title, category, venue, city,
    date, starts_at, end_time,
    price, tag, description, extras,
    capacity, access, image_url, tags
  ) VALUES

  -- ── 1. Jazz & Scotch at Purl ──────────────────────────────────────────────
  (c,
   'Jazz & Scotch at Purl',
   'music', 'Purl Bar & Kitchen', 'Hyderabad',
   '9 May · 20:00', '2026-05-09 14:30:00+00', '',
   '₹400', 'Music',
   'Small room, six musicians, good whisky. We''ve been sitting on these Coltrane charts for three months — this is the first time we''re playing them for anyone outside the practice space. Purl are letting us use the back room from 8 onwards. Dress code is none, but we''d appreciate you not taking calls.',
   'Bar tab is your own. Arrive by 8:30 if you want a seat — we won''t be stopping to find you one after we start.',
   25, 'approval',
   'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=800&q=80',
   ARRAY['Jazz', 'Live Music', 'Vinyl Collecting']),

  -- ── 2. The Biryani Crawl ──────────────────────────────────────────────────
  (c,
   'The Biryani Crawl',
   'food', 'Shadab Hotel (meeting point)', 'Hyderabad',
   '10 May · 11:00', '2026-05-10 05:30:00+00', '',
   '₹350', 'Food',
   'Three spots, one afternoon, the only rule is you finish your plate. We start at Shadab on High Court Road, walk to a place in Ghansi Bazaar that has no name on the door, and end at a third spot I''m not going to name here. Bring comfortable shoes and an opinion.',
   'Meet outside Shadab at 11am sharp. About 4km of walking in total. Parking is a nightmare in the Old City — take the metro to Charminar.',
   12, 'open',
   'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
   ARRAY['Cooking', 'Food Photography', 'Brunch']),

  -- ── 3. Life Drawing at Kalakriti ─────────────────────────────────────────
  (c,
   'Life Drawing at Kalakriti',
   'arts', 'Kalakriti Art Gallery', 'Hyderabad',
   '11 May · 15:00', '2026-05-11 09:30:00+00', '',
   '₹600', 'Arts',
   'Figure drawing with a live model. Easels and paper provided — bring your own pencils if you''re particular about them. No formal training needed. People who''ve never drawn before often get more out of these sessions because they don''t have habits to unlearn.',
   'Kalakriti is off Road No. 10, Banjara Hills. Parking in the lane behind the gallery. If you have a preferred medium, bring your own materials.',
   8, 'approval',
   'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80',
   ARRAY['Painting', 'Sketching', 'Photography']),

  -- ── 4. The Next Chapter ───────────────────────────────────────────────────
  (c,
   'The Next Chapter',
   'lit', 'Lamakaan', 'Hyderabad',
   '12 May · 18:30', '2026-05-12 13:00:00+00', '',
   'Free', 'Lit',
   'This month we''re reading Perumal Murugan''s One Part Woman. It''s not an easy read and the ending divided the group badly last time. Come prepared to defend your interpretation. Chai and biscuits from 6:30, we start at 7.',
   'This is not a gentle book club. We argue. If you haven''t finished the book, still come — just maybe don''t lead the discussion.',
   NULL, 'open',
   'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80',
   ARRAY['Book Clubs', 'Reading', 'Philosophy']),

  -- ── 5. 6am Tennis at YMCA ─────────────────────────────────────────────────
  (c,
   '6am Tennis at YMCA',
   'sports', 'YMCA, Nampally', 'Hyderabad',
   '13 May · 06:00', '2026-05-13 00:30:00+00', '',
   'Free', 'Sports',
   'Doubles round-robin before the city gets going. We''ve been running this every other Saturday for eight months. Intermediate level — you should be able to sustain a rally, but nobody''s expecting Wimbledon. Four courts, usually 12 to 16 people.',
   'Bring your own racket. Court fees are split on the day — comes to about ₹80 per person. Gates open at 5:45.',
   16, 'approval',
   'https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800&q=80',
   ARRAY['Tennis', 'Badminton', 'Running']),

  -- ── 6. Short Films & Filter Coffee ───────────────────────────────────────
  (c,
   'Short Films & Filter Coffee',
   'film', 'Lamakaan', 'Hyderabad',
   '15 May · 19:00', '2026-05-15 13:30:00+00', '',
   '₹200', 'Film',
   'Six shorts, all under 20 minutes, all made in Hyderabad in the last two years. Followed by a conversation with two of the directors. We tried to do this monthly — last session forty people showed up and we ran out of chairs. First come, first seated.',
   'Lamakaan provides filter coffee. Show starts at 7:30 sharp because we need to clear out by 10.',
   50, 'open',
   'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80',
   ARRAY['Short Films', 'Cinema', 'Film Making']),

  -- ── 7. Founders Breakfast ─────────────────────────────────────────────────
  (c,
   'Founders Breakfast',
   'networking', 'Roastery Coffee House, Jubilee Hills', 'Hyderabad',
   '16 May · 08:30', '2026-05-16 03:00:00+00', '',
   'Free', 'Networking',
   'Twelve seats. One conversation. No decks, no pitches — just people building things talking about what''s actually hard right now. Last session had founders from healthtech, SaaS, and someone in agri logistics that changed how I think about distribution.',
   'Breakfast is on us. Confirm by Wednesday so we can book the right table at Roastery. Jubilee Hills location, the one on the main road.',
   12, 'approval',
   'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
   ARRAY['Startups', 'Entrepreneurship', 'Leadership']),

  -- ── 8. Telescope Night ────────────────────────────────────────────────────
  (c,
   'Telescope Night',
   'other', 'Nehru Zoological Park', 'Hyderabad',
   '17 May · 21:00', '2026-05-17 15:30:00+00', '',
   '₹300', 'Other',
   'Clear skies forecast. Two 8-inch Dobsonians set up after the park closes — security has cleared it. Saturn''s rings are well-placed right now, and there''s a globular cluster in Hercules that''s been worth looking at every night this month. No experience needed.',
   'Enter from Gate 2 and walk toward the central fountain. Bring a jacket — it gets cold after midnight even in May. Last entry at 10pm.',
   20, 'approval',
   'https://images.unsplash.com/photo-1453847668862-487637052f8a?w=800&q=80',
   ARRAY['Astronomy', 'Stargazing', 'Camping']),

  -- ── 9. Carnatic x Jazz ────────────────────────────────────────────────────
  (c,
   'Carnatic x Jazz',
   'music', 'Fandom Bar, Jubilee Hills', 'Hyderabad',
   '20 May · 21:00', '2026-05-20 15:30:00+00', '',
   'Free', 'Music',
   'Sruthi on violin, trained in Carnatic. Mohan on keys, trained in jazz. They''ve been rehearsing together for six weeks and are very confused by each other in the best way. This is their first performance. Fandom has been generous with the space — no cover charge, but please order something.',
   'Tables fill up by 9. Fandom is in Jubilee Hills, parking on the road. Kitchen closes at 10:30 so order food when you arrive.',
   NULL, 'open',
   'https://images.unsplash.com/photo-1506157154730-8f0745cc45a9?w=800&q=80',
   ARRAY['Jazz', 'Live Music', 'Concerts']),

  -- ── 10. Wheel Throwing for Beginners ─────────────────────────────────────
  (c,
   'Wheel Throwing for Beginners',
   'arts', 'Studio Ekaa', 'Hyderabad',
   '22 May · 17:00', '2026-05-22 11:30:00+00', '',
   '₹800', 'Arts',
   'Six students max. Three hours. You''ll throw two or three small pieces on the wheel and probably ruin at least one — that''s part of it. Meena has been teaching here for nine years and is remarkably calm about the mess. Studio Ekaa fires your pieces and you collect them the following weekend.',
   'Wear something you''re okay ruining. Clay, tools, and apron are all provided. Studio Ekaa is in Jubilee Hills, next to the post office.',
   6, 'approval',
   'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&q=80',
   ARRAY['Pottery', 'Painting', 'Sketching']),

  -- ── 11. The Sting (1973) at Prithvi ──────────────────────────────────────
  (c,
   'The Sting (1973) at Prithvi',
   'film', 'Prithvi Theatre', 'Mumbai',
   '24 May · 20:00', '2026-05-24 14:30:00+00', '',
   '₹300', 'Film',
   '35mm print, Prithvi''s restored screen, proper sound system. We''re doing a series of pre-1980 films — each chosen by someone different, with a short intro before it starts. This month''s pick is The Sting. Someone in the group has strong feelings about it and has been lobbying for three months.',
   'Prithvi''s café is worth arriving early for. The 35mm format means no pause for intermission. Running time is 129 minutes.',
   NULL, 'open',
   'https://images.unsplash.com/photo-1535016120720-40dce8a3253b?w=800&q=80',
   ARRAY['Cinema', 'Film Making', 'Documentaries']),

  -- ── 12. Nandi Hills at Sunrise ────────────────────────────────────────────
  (c,
   'Nandi Hills at Sunrise',
   'sports', 'Nandi Hills (base)', 'Bangalore',
   '25 May · 05:30', '2026-05-25 00:00:00+00', '',
   'Free', 'Sports',
   '5:30am at the base. Ninety minutes up, as long as you want at the top, back down by 9:30. The view at sunrise is the point — you don''t get it any other way. Moderate fitness required, sturdy shoes. We''ve done this fourteen times and nobody has ever regretted waking up early.',
   'Entry to Nandi Hills is ₹15. We usually stop at a dhaba on NH7 for breakfast on the way back — budget another ₹100 for that.',
   20, 'open',
   'https://images.unsplash.com/photo-1546483875-ad9aa541af1a?w=800&q=80',
   ARRAY['Hiking', 'Running', 'Camping']);

  -- ── Auto-RSVP the host to their own events (matches app behaviour) ────────
  INSERT INTO public.rsvps (user_id, event_id)
  SELECT c, id
  FROM public.events
  WHERE creator_id = c
    AND starts_at > NOW() - INTERVAL '1 minute'
  ON CONFLICT (user_id, event_id) DO NOTHING;

END $$;
