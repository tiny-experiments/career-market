-- The skills the builder set out to pull on each snapshot day, whether or not
-- krill answered for them. A skill krill failed has no skill_summary row that
-- day; the Skill page serves it from its last good day only while it is still
-- in the latest tracked set. A skill that left the set is no longer served.
create table skill_tracked (
  date  date not null,
  skill text not null,
  primary key (date, skill)
);
