import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AdminService } from '../admin/admin.service';
import { Category } from './category.entity';

type CategoryChildResponse = {
  id: string;
  name: string;
  slug: string;
};

type CategoryResponse = Omit<Category, 'parent' | 'children'> & {
  parentId: string | null;
  children: CategoryChildResponse[];
};

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly adminService: AdminService
  ) {}

  @Get()
  async findAll(@Query('active') active?: string) {
    const categories =
      active === 'true'
        ? await this.categoriesService.findActive()
        : await this.categoriesService.findAll();
    return categories.map(category => this.toResponse(category));
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const category = await this.categoriesService.findBySlug(slug);
    return category ? this.toResponse(category) : null;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() actor: AuthUser
  ) {
    const category = await this.categoriesService.create(createCategoryDto);
    await this.adminService.recordLog({
      action: 'categories.create',
      actorName: actor.email,
      actorRole: actor.role,
      details: `Création catégorie ${category.name} (${category.id})`
    });
    return this.toResponse(category);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() actor: AuthUser
  ) {
    const category = await this.categoriesService.update(id, updateCategoryDto);
    await this.adminService.recordLog({
      action: 'categories.update',
      actorName: actor.email,
      actorRole: actor.role,
      details: `Mise à jour catégorie ${category.name} (${category.id})`
    });
    return this.toResponse(category);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser
  ) {
    await this.categoriesService.remove(id);
    await this.adminService.recordLog({
      action: 'categories.delete',
      actorName: actor.email,
      actorRole: actor.role,
      details: `Suppression catégorie ${id}`
    });
    return { success: true };
  }

  @Get(':id/form')
  async getFormSchema(@Param('id') id: string) {
    const category = await this.categoriesService.getFormSchema(id);
    // We can create a specific response DTO later if needed
    return category;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const category = await this.categoriesService.findOne(id);
    return this.toResponse(category);
  }

  private toResponse(category: Category): CategoryResponse {
    const { parent, children, ...rest } = category;
    return {
      ...(rest as Omit<Category, 'parent'>),
      parentId: parent?.id ?? null,
      extraFields: rest.extraFields ?? [],
      children: (children ?? []).map(child => ({
        id: child.id,
        name: child.name,
        slug: child.slug
      }))
    };
  }
}
