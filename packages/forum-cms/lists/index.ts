import User from './user'
import Member from './member'
import Nationality from './nationality'
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
import Category from './category'
import Tag from './tag'
import Ad from './ad'

export const listDefinition = {
  User,
  Member,
  Nationality,
  OfficialMapping,
  Post,
  Topic,
  EditorChoice,
  Comment,
  Reaction,
  Bookmark,
  Poll,
  PollOption,
  PollVote,
  Content,
  Report,
  ForbiddenKeyword,
  Video,
  Photo: Image,
  Category,
  Tag,
  Ad,
}
