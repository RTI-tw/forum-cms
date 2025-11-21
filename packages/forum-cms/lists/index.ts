import User from './user'
import Category from './category'
import Comment from './comment'
import Member from './member'
import Story from './story'
import Tag from './tag'
import Image from './image'
import StoryType from './story_type'

export const listDefinition = {
  User,
  Category,
  Comment,
  Story,
  StoryType,
  Tag,
  Member,
  Photo: Image,
}
