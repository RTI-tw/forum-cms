import User from './user'
import Member from './member'
import OfficialMapping from './official-mapping'
import Post from './Post'
import Topic from './topic'
import EditorChoice from './editor-choice'
import Comment from './comment'
import Reaction from './Reaction'
import Bookmark from './bookmark'
import Poll from './poll'
import PollOption from './poll-option'
import PollVote from './poll-vote'
import Content from './static-content'
import Report from './report'
import ForbiddenKeyword from './forbidden-keyword'
import Video from './video'
import Image from './image'
import Ad from './ad'
import AdSlide from './ad-slide'
import HomepageImage from './homepage-image'
import RssKeyword from './rss-keyword'
import RssTopicMapping from './rss-topic-mapping'
import Event from './event'
import EventRegistration from './event-registration'
import { isPartnerUiSession } from '../utils/partner-access'

function hiddenFromPartner<T extends { ui?: Record<string, unknown> }>(config: T): T {
  return {
    ...config,
    ui: {
      ...config.ui,
      isHidden: isPartnerUiSession,
    },
  }
}

export const listDefinition = {
  User: hiddenFromPartner(User),
  Member: hiddenFromPartner(Member),
  OfficialMapping: hiddenFromPartner(OfficialMapping),
  Post,
  Topic: hiddenFromPartner(Topic),
  EditorChoice: hiddenFromPartner(EditorChoice),
  Comment,
  Reaction: hiddenFromPartner(Reaction),
  Bookmark: hiddenFromPartner(Bookmark),
  Poll,
  PollOption,
  PollVote,
  Content: hiddenFromPartner(Content),
  Report: hiddenFromPartner(Report),
  ForbiddenKeyword: hiddenFromPartner(ForbiddenKeyword),
  Video: hiddenFromPartner(Video),
  Photo: hiddenFromPartner(Image),
  Ad: hiddenFromPartner(Ad),
  AdSlide: hiddenFromPartner(AdSlide),
  HomepageImage: hiddenFromPartner(HomepageImage),
  RssKeyword: hiddenFromPartner(RssKeyword),
  RssTopicMapping: hiddenFromPartner(RssTopicMapping),
  Event,
  EventRegistration,
}
